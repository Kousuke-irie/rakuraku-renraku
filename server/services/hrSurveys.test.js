import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  buildAssigneeHrSurvey,
  buildHrSurveyState,
  buildHrSurveyView,
  listHrSurveyComments,
  resolveAssigneeId,
  saveHrSurvey,
} from './hrSurveys.js';
import {
  HR_SURVEY_AXIS,
  HR_SURVEY_MIN_SAMPLE,
  HR_SURVEY_SCOPE_ALL,
  HR_SURVEY_UNKNOWN_ASSIGNEE_ID,
  SELECTION_STATUS,
} from '../../shared/constants.js';

const NOW = '2026-08-06T00:00:00.000Z';

const FULL_MARKS = {
  [HR_SURVEY_AXIS.SPEED]: 5,
  [HR_SURVEY_AXIS.CLARITY]: 5,
  [HR_SURVEY_AXIS.COURTESY]: 5,
};

/**
 * 人事2名（担当あり／なし）と学生5名を置く。
 * 学生A=内定・学生B=辞退・学生C=二次面接（選考中）・学生D/E=内定。
 * A/D/E は人事1、B は人事2、C は担当なしのルームに紐づける。
 */
function createDatabase() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../db/schema.sql'), 'utf8'));
  db.exec(`
    INSERT INTO users (id, login_id, password_hash, display_name, role, created_at, updated_at) VALUES
      (1, 'hr1', 'hash', '人事1', 'hr', '${NOW}', '${NOW}'),
      (2, 'hr2', 'hash', '人事2', 'hr', '${NOW}', '${NOW}'),
      (10, 'student-a', 'hash', '学生A', 'student', '${NOW}', '${NOW}'),
      (11, 'student-b', 'hash', '学生B', 'student', '${NOW}', '${NOW}'),
      (12, 'student-c', 'hash', '学生C', 'student', '${NOW}', '${NOW}'),
      (13, 'student-d', 'hash', '学生D', 'student', '${NOW}', '${NOW}'),
      (14, 'student-e', 'hash', '学生E', 'student', '${NOW}', '${NOW}');
    INSERT INTO students (user_id, selection_status, schedule_state, updated_at) VALUES
      (10, '${SELECTION_STATUS.OFFER}', 'none', '${NOW}'),
      (11, '${SELECTION_STATUS.DECLINED}', 'none', '${NOW}'),
      (12, '${SELECTION_STATUS.INTERVIEW_2}', 'none', '${NOW}'),
      (13, '${SELECTION_STATUS.OFFER}', 'none', '${NOW}'),
      (14, '${SELECTION_STATUS.OFFER}', 'none', '${NOW}');
    INSERT INTO rooms (id, student_user_id, assignee_user_id, handling_status, urgency, created_at) VALUES
      (100, 10, 1, 'needs_reply', 'normal', '${NOW}'),
      (101, 11, 2, 'needs_reply', 'normal', '${NOW}'),
      (102, 12, 1, 'needs_reply', 'normal', '${NOW}'),
      (103, 13, 1, 'needs_reply', 'normal', '${NOW}'),
      (104, 14, NULL, 'needs_reply', 'normal', '${NOW}');
    INSERT INTO room_members (room_id, user_id, joined_at) VALUES
      (100, 10, '${NOW}'), (101, 11, '${NOW}'), (102, 12, '${NOW}'),
      (103, 13, '${NOW}'), (104, 14, '${NOW}');
  `);
  return db;
}

/** 集計テスト用。saveHrSurvey を通さず直接入れる（回答可否の判定はここでは問わない） */
function insertSurvey(db, { studentUserId, assigneeUserId, outcome, ratings, comment = null }) {
  db.prepare(
    `INSERT INTO hr_surveys
       (student_user_id, assignee_user_id, outcome_status,
        rating_speed, rating_clarity, rating_courtesy, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    studentUserId,
    assigneeUserId,
    outcome,
    ratings[HR_SURVEY_AXIS.SPEED],
    ratings[HR_SURVEY_AXIS.CLARITY],
    ratings[HR_SURVEY_AXIS.COURTESY],
    comment,
    NOW
  );
}

/** 匿名性の下限を満たすだけの回答を、指定の担当者に積む */
function fillToMinSample(db, assigneeUserId, startStudentUserId) {
  for (let index = 0; index < HR_SURVEY_MIN_SAMPLE; index += 1) {
    const studentUserId = startStudentUserId + index;
    db.prepare(
      `INSERT INTO users (id, login_id, password_hash, display_name, role, created_at, updated_at)
       VALUES (?, ?, 'hash', ?, 'student', ?, ?)`
    ).run(studentUserId, `filler-${studentUserId}`, `補充${studentUserId}`, NOW, NOW);

    insertSurvey(db, {
      studentUserId,
      assigneeUserId,
      outcome: SELECTION_STATUS.OFFER,
      ratings: FULL_MARKS,
      comment: `補充の回答${index}`,
    });
  }
}

test('選考が終わった学生だけが回答できる', () => {
  const db = createDatabase();

  const offered = saveHrSurvey(db, {
    studentUserId: 10,
    ratings: FULL_MARKS,
    comment: 'ご対応ありがとうございました',
  });
  assert.ok(offered.answeredAt);

  // 辞退も対象。**辞退者の声こそ改善の材料**なので落とさない
  const declined = saveHrSurvey(db, { studentUserId: 11, ratings: FULL_MARKS });
  assert.ok(declined.answeredAt);

  // 選考中は回答できない
  const inProgress = saveHrSurvey(db, { studentUserId: 12, ratings: FULL_MARKS });
  assert.ok(inProgress.error);

  assert.equal(buildHrSurveyState(db, 10).answered, true);
  assert.equal(buildHrSurveyState(db, 12).answerable, false);
});

test('3軸すべてが★の範囲内でないと保存しない', () => {
  const db = createDatabase();

  for (const invalid of [0, 6, 3.5, Number.NaN, undefined]) {
    const result = saveHrSurvey(db, {
      studentUserId: 10,
      ratings: { ...FULL_MARKS, [HR_SURVEY_AXIS.CLARITY]: invalid },
    });
    assert.ok(result.error, `${invalid} は弾かれるべき`);
  }

  assert.equal(buildHrSurveyState(db, 10).answered, false);
});

test('回答は1回きりで上書きされない', () => {
  const db = createDatabase();

  saveHrSurvey(db, { studentUserId: 10, ratings: FULL_MARKS, comment: '1回目' });
  const second = saveHrSurvey(db, {
    studentUserId: 10,
    ratings: { [HR_SURVEY_AXIS.SPEED]: 1, [HR_SURVEY_AXIS.CLARITY]: 1, [HR_SURVEY_AXIS.COURTESY]: 1 },
    comment: '2回目',
  });

  // 2回目もエラーにはしない（学生には見せない）が、中身は1回目のまま
  assert.ok(second.answeredAt);
  const view = buildHrSurveyView(db);
  assert.equal(view.overall.count, 1);
  assert.equal(view.overall.avgOverall, 5);
});

test('担当人事は回答時点のルームからスナップショットする', () => {
  const db = createDatabase();

  assert.equal(resolveAssigneeId(db, 10), 1);
  // 担当未割当のルームは null。推測で埋めない
  assert.equal(resolveAssigneeId(db, 14), null);

  saveHrSurvey(db, { studentUserId: 10, ratings: FULL_MARKS });
  // 回答後に担当を付け替えても、過去の評価は動かない
  db.prepare('UPDATE rooms SET assignee_user_id = 2 WHERE id = 100').run();

  const row = db.prepare('SELECT assignee_user_id AS id FROM hr_surveys').get();
  assert.equal(row.id, 1);
});

test('回答が下限に満たない担当者は個別に出さず、件数だけ返す', () => {
  const db = createDatabase();

  fillToMinSample(db, 1, 200);
  // 人事2は1件だけ＝下限未満
  insertSurvey(db, {
    studentUserId: 11,
    assigneeUserId: 2,
    outcome: SELECTION_STATUS.DECLINED,
    ratings: { [HR_SURVEY_AXIS.SPEED]: 2, [HR_SURVEY_AXIS.CLARITY]: 2, [HR_SURVEY_AXIS.COURTESY]: 2 },
    comment: '連絡が遅かったです',
  });

  const view = buildHrSurveyView(db);
  assert.deepEqual(
    view.assignees.map((row) => row.displayName),
    ['人事1']
  );
  assert.equal(view.suppressed.assigneeCount, 1);
  assert.equal(view.suppressed.responseCount, 1);
  // 伏せたぶんも全体の数字には含める（合計が合わないと集計が信用されない）
  assert.equal(view.overall.count, HR_SURVEY_MIN_SAMPLE + 1);
});

test('総合平均は3軸すべての★の平均になる', () => {
  const db = createDatabase();

  insertSurvey(db, {
    studentUserId: 10,
    assigneeUserId: 1,
    outcome: SELECTION_STATUS.OFFER,
    ratings: { [HR_SURVEY_AXIS.SPEED]: 2, [HR_SURVEY_AXIS.CLARITY]: 5, [HR_SURVEY_AXIS.COURTESY]: 5 },
  });

  const view = buildHrSurveyView(db);
  assert.equal(view.overall.avgOverall, 4);
  assert.equal(view.overall.axisAverages[HR_SURVEY_AXIS.SPEED], 2);
});

test('自由記述は担当者スコープでは下限未満だと落ちる／全体スコープでは読める', () => {
  const db = createDatabase();

  insertSurvey(db, {
    studentUserId: 11,
    assigneeUserId: 2,
    outcome: SELECTION_STATUS.DECLINED,
    ratings: FULL_MARKS,
    comment: '連絡が遅かったです',
  });

  const scoped = listHrSurveyComments(db, '2');
  assert.equal(scoped.isSuppressed, true);
  assert.deepEqual(scoped.comments, []);

  // 全体スコープは担当者を伏せるので、少数派の回答も読める
  const all = listHrSurveyComments(db, HR_SURVEY_SCOPE_ALL);
  assert.equal(all.isSuppressed, false);
  assert.equal(all.comments.length, 1);
  // ★回答者を辿れる情報を返さない
  assert.deepEqual(Object.keys(all.comments[0]).sort(), [
    'avgOverall',
    'body',
    'id',
    'outcomeLabel',
    'outcomeStatus',
    'ratings',
  ]);
});

test('担当者未割当の回答は unknown スコープにまとまる', () => {
  const db = createDatabase();

  fillToMinSample(db, null, 300);

  const view = buildHrSurveyView(db);
  const unknown = view.assignees.find((row) => row.id === HR_SURVEY_UNKNOWN_ASSIGNEE_ID);
  assert.ok(unknown);
  assert.equal(unknown.isUnknown, true);
  assert.equal(unknown.count, HR_SURVEY_MIN_SAMPLE);
});

test('個人ダッシュボードも下限未満なら数字を返さない', () => {
  const db = createDatabase();

  insertSurvey(db, {
    studentUserId: 10,
    assigneeUserId: 1,
    outcome: SELECTION_STATUS.OFFER,
    ratings: FULL_MARKS,
  });

  const few = buildAssigneeHrSurvey(db, 1);
  assert.equal(few.isSuppressed, true);
  assert.equal(few.avgOverall, null);
  // 件数だけは返す（あと何件で読めるようになるかが分かるため）
  assert.equal(few.count, 1);
  // 分母は「担当学生のうち選考が終わっている人数」。学生A・Dの2名
  assert.equal(few.answerableCount, 2);

  fillToMinSample(db, 1, 400);
  const enough = buildAssigneeHrSurvey(db, 1);
  assert.equal(enough.isSuppressed, false);
  assert.equal(enough.avgOverall, 5);
});

test('回答率の分母は選考が終わった学生の数', () => {
  const db = createDatabase();

  // 学生A・B・D・E の4名が選考終了。学生C（二次面接）は数えない
  assert.equal(buildHrSurveyView(db).answerableCount, 4);
});
