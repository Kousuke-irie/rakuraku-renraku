import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  buildInterviewSurveyView,
  findAnsweredStatusKeys,
  listComments,
  resolveInterviewerId,
  saveSurvey,
} from './interviewSurveys.js';
import { INTERVIEW_SURVEY_MIN_SAMPLE, SELECTION_STATUS } from '../../shared/constants.js';

const NOW = '2026-08-06T00:00:00.000Z';

/**
 * 学生3名（1名は一次面接まで完了、1名は三次面接まで完了、1名はエントリー）と
 * 面接官2名を置く。面接官Aには MIN_SAMPLE 以上、面接官Bには1件だけ回答を入れ、
 * 匿名性の下限が効くことを確かめられるようにする。
 */
function createDatabase() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../db/schema.sql'), 'utf8'));
  db.exec(`
    INSERT INTO users (id, login_id, password_hash, display_name, role, created_at, updated_at) VALUES
      (1, 'hr', 'hash', '人事', 'hr', '${NOW}', '${NOW}'),
      (2, 'student-a', 'hash', '学生A', 'student', '${NOW}', '${NOW}'),
      (3, 'student-b', 'hash', '学生B', 'student', '${NOW}', '${NOW}'),
      (4, 'student-c', 'hash', '学生C', 'student', '${NOW}', '${NOW}');
    INSERT INTO students (user_id, selection_status, schedule_state, updated_at) VALUES
      (2, '${SELECTION_STATUS.INTERVIEW_2}', 'none', '${NOW}'),
      (3, '${SELECTION_STATUS.OFFER}', 'none', '${NOW}'),
      (4, '${SELECTION_STATUS.ENTRY}', 'none', '${NOW}');
    INSERT INTO calendar_interviewers (id, external_id, display_name, department, created_at, updated_at) VALUES
      (7, 'ext-a', '面接官A', '開発部', '${NOW}', '${NOW}'),
      (8, 'ext-b', '面接官B', '営業部', '${NOW}', '${NOW}');
    INSERT INTO rooms (id, student_user_id, handling_status, urgency, created_at) VALUES
      (10, 2, 'needs_reply', 'normal', '${NOW}');
  `);
  return db;
}

/** 集計テスト用。saveSurvey を通さず直接入れる（回答可否の判定はここでは問わない） */
function insertSurvey(db, { studentUserId, statusKey, interviewerId, rating, comment = null }) {
  db.prepare(
    `INSERT INTO interview_surveys
       (student_user_id, status_key, interviewer_id, rating, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(studentUserId, statusKey, interviewerId, rating, comment, NOW);
}

test('完了済みの面接ステップにだけ回答できる', () => {
  const db = createDatabase();

  // 学生Aは二次面接に在籍中＝一次面接だけが完了済み
  const ok = saveSurvey(db, {
    studentUserId: 2,
    statusKey: SELECTION_STATUS.INTERVIEW_1,
    rating: 4,
    comment: '丁寧でした',
  });
  assert.equal(ok.statusKey, SELECTION_STATUS.INTERVIEW_1);

  // 進行中のステップには回答できない
  const current = saveSurvey(db, {
    studentUserId: 2,
    statusKey: SELECTION_STATUS.INTERVIEW_2,
    rating: 4,
  });
  assert.ok(current.error);

  // 面接以外のステップも対象外
  const notInterview = saveSurvey(db, {
    studentUserId: 2,
    statusKey: SELECTION_STATUS.DOCUMENT,
    rating: 4,
  });
  assert.ok(notInterview.error);

  assert.deepEqual([...findAnsweredStatusKeys(db, 2)], [SELECTION_STATUS.INTERVIEW_1]);
});

test('★の範囲外は保存しない', () => {
  const db = createDatabase();

  for (const rating of [0, 6, 3.5, Number.NaN]) {
    const result = saveSurvey(db, {
      studentUserId: 2,
      statusKey: SELECTION_STATUS.INTERVIEW_1,
      rating,
    });
    assert.ok(result.error, `rating=${rating} は弾かれるべき`);
  }
});

test('二重送信しても最初の1件だけが残る', () => {
  const db = createDatabase();

  saveSurvey(db, { studentUserId: 2, statusKey: SELECTION_STATUS.INTERVIEW_1, rating: 5 });
  saveSurvey(db, { studentUserId: 2, statusKey: SELECTION_STATUS.INTERVIEW_1, rating: 1 });

  const rows = db.prepare('SELECT rating FROM interview_surveys WHERE student_user_id = 2').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rating, 5, '後から送られた評価で上書きしない');
});

test('面接官は予約実績から引き、表示名の自由入力には依存しない', () => {
  const db = createDatabase();
  db.prepare(
    `INSERT INTO schedule_requests (
       room_id, student_user_id, interviewer_id, created_by_user_id,
       selection_stage, selection_status_key, duration_minutes,
       available_from, available_until, response_deadline, interview_format,
       status, booked_starts_at, created_at, updated_at
     ) VALUES (10, 2, 7, 1, '1次（現場）', ?, 30, ?, ?, ?, 'online', 'booked', ?, ?, ?)`
  ).run(
    SELECTION_STATUS.INTERVIEW_1,
    NOW,
    '2026-08-20T00:00:00.000Z',
    '2026-08-10T00:00:00.000Z',
    '2026-08-01T01:00:00.000Z',
    NOW,
    NOW
  );

  assert.equal(
    resolveInterviewerId(db, { studentUserId: 2, statusKey: SELECTION_STATUS.INTERVIEW_1 }),
    7
  );
  // 予約が無いステップは推測しない
  assert.equal(
    resolveInterviewerId(db, { studentUserId: 2, statusKey: SELECTION_STATUS.INTERVIEW_2 }),
    null
  );

  saveSurvey(db, { studentUserId: 2, statusKey: SELECTION_STATUS.INTERVIEW_1, rating: 4 });
  const saved = db
    .prepare('SELECT interviewer_id AS interviewerId FROM interview_surveys WHERE student_user_id = 2')
    .get();
  assert.equal(saved.interviewerId, 7);
});

test('回答が下限に満たない面接官は個別の行にせず件数だけ返す', () => {
  const db = createDatabase();
  for (let i = 0; i < INTERVIEW_SURVEY_MIN_SAMPLE; i += 1) {
    insertSurvey(db, {
      studentUserId: 2 + (i % 3),
      statusKey: `interview_${i + 1}`,
      interviewerId: 7,
      rating: 5,
      comment: `A への意見${i}`,
    });
  }
  insertSurvey(db, {
    studentUserId: 3,
    statusKey: SELECTION_STATUS.INTERVIEW_4,
    interviewerId: 8,
    rating: 1,
    comment: 'B への意見',
  });

  const view = buildInterviewSurveyView(db);
  assert.deepEqual(
    view.interviewers.map((item) => item.displayName),
    ['面接官A']
  );
  assert.equal(view.suppressed.interviewerCount, 1);
  assert.equal(view.suppressed.responseCount, 1);
  // 全体の母数には伏せたぶんも含める（数字が合わないと集計が信用されない）
  assert.equal(view.overall.count, INTERVIEW_SURVEY_MIN_SAMPLE + 1);
});

test('自由記述は回答者を特定できる形で返さない', () => {
  const db = createDatabase();
  for (let i = 0; i < INTERVIEW_SURVEY_MIN_SAMPLE; i += 1) {
    insertSurvey(db, {
      studentUserId: 2 + (i % 3),
      statusKey: `interview_${i + 1}`,
      interviewerId: 7,
      rating: 4,
      comment: `A への意見${i}`,
    });
  }
  insertSurvey(db, {
    studentUserId: 3,
    statusKey: SELECTION_STATUS.INTERVIEW_4,
    interviewerId: 8,
    rating: 1,
    comment: 'B への意見',
  });

  const scoped = listComments(db, '7');
  assert.equal(scoped.isSuppressed, false);
  assert.equal(scoped.comments.length, INTERVIEW_SURVEY_MIN_SAMPLE);
  for (const comment of scoped.comments) {
    assert.equal('studentUserId' in comment, false, '回答者IDを返さない');
    assert.equal('createdAt' in comment, false, '回答日時を返さない');
  }

  // 回答が少ない面接官は本文を一切出さない
  const suppressed = listComments(db, '8');
  assert.equal(suppressed.isSuppressed, true);
  assert.deepEqual(suppressed.comments, []);

  // 全体スコープは面接官が伏せられるので、少数の面接官のぶんも含めてよい
  const all = listComments(db, 'all');
  assert.equal(all.isSuppressed, false);
  assert.equal(all.comments.length, INTERVIEW_SURVEY_MIN_SAMPLE + 1);
});

test('回答率の分母は完了済みの面接ステップ数と一致する', () => {
  const db = createDatabase();
  const view = buildInterviewSurveyView(db);

  // 学生A（二次面接在籍）＝一次のみ完了で1、学生B（内定）＝既定で有効な一次〜三次の3、
  // 学生C（エントリー）＝0
  assert.equal(view.answerableCount, 4);
});
