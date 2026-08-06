import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ALERT_KIND, ROLE, SELECTION_STATUS } from '../../shared/constants.js';
import {
  isSelectionAdvanced,
  notifySelectionAdvanced,
  notifyVisibleFeedbacks,
} from './studentNotifier.js';

const NOW = Date.parse('2026-08-06T12:00:00.000Z');

/**
 * 学生向け通知が触る範囲だけの最小構成。
 * selection_steps は空にしておく（selectionFlow.js の既定ステップが使われる）。
 */
function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE students (
      user_id INTEGER PRIMARY KEY,
      selection_status TEXT NOT NULL
    );
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_user_id INTEGER,
      assignee_user_id INTEGER
    );
    CREATE TABLE selection_steps (
      status_key TEXT PRIMARY KEY,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL,
      label TEXT,
      description TEXT,
      points TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE selection_feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_user_id INTEGER NOT NULL,
      status_key TEXT NOT NULL,
      body TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(student_user_id, status_key)
    );
    -- 学生の選考メモ（S-10）。buildStudentFlow が一緒に引くので必要
    CREATE TABLE student_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_user_id INTEGER NOT NULL,
      note_key TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(student_user_id, note_key)
    );
    CREATE TABLE alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL,
      room_id INTEGER NOT NULL,
      target_user_id INTEGER,
      actor_user_id INTEGER,
      trigger_message_id INTEGER,
      rule_code TEXT,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      resolved_at TEXT
    );
    -- ★多重通知を防ぐ唯一の仕組み
    CREATE UNIQUE INDEX idx_alerts_student_unique
      ON alerts(kind, room_id, target_user_id, rule_code)
      WHERE kind IN ('student_selection_advanced', 'student_feedback_published');
  `);
  return db;
}

function addUser(db, displayName, role) {
  return Number(
    db.prepare(`INSERT INTO users (display_name, role) VALUES (?, ?)`).run(displayName, role)
      .lastInsertRowid,
  );
}

function addStudent(db, { selectionStatus }) {
  const studentUserId = addUser(db, '学生', ROLE.STUDENT);
  db.prepare(`INSERT INTO students (user_id, selection_status) VALUES (?, ?)`).run(
    studentUserId,
    selectionStatus,
  );

  const roomId = Number(
    db.prepare(`INSERT INTO rooms (student_user_id) VALUES (?)`).run(studentUserId).lastInsertRowid,
  );

  return { studentUserId, roomId };
}

function addFeedback(db, studentUserId, statusKey, authorId) {
  db.prepare(
    `INSERT INTO selection_feedbacks
       (student_user_id, status_key, body, author_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(studentUserId, statusKey, '面接ありがとうございました。', authorId, '2026-08-01', '2026-08-01');
}

function alertRows(db) {
  return db.prepare(`SELECT * FROM alerts ORDER BY id`).all();
}

test('isSelectionAdvanced は進んだときだけ true', () => {
  assert.equal(
    isSelectionAdvanced(SELECTION_STATUS.INTERVIEW_1, SELECTION_STATUS.INTERVIEW_2),
    true,
  );
  assert.equal(isSelectionAdvanced(SELECTION_STATUS.INTERVIEW_2, SELECTION_STATUS.OFFER), true);
  assert.equal(
    isSelectionAdvanced(SELECTION_STATUS.INTERVIEW_2, SELECTION_STATUS.INTERVIEW_2),
    false,
    '同じなら通知しない',
  );
  assert.equal(
    isSelectionAdvanced(SELECTION_STATUS.INTERVIEW_2, SELECTION_STATUS.INTERVIEW_1),
    false,
    '戻したときは通知しない（打ち間違いの訂正でお祝いを飛ばさない）',
  );
  assert.equal(
    isSelectionAdvanced(SELECTION_STATUS.INTERVIEW_2, SELECTION_STATUS.DECLINED),
    false,
    '辞退は本人の申し出の登録なので通知しない',
  );
});

test('選考が進むと本人宛に1件だけ通知される', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const { studentUserId, roomId } = addStudent(db, {
    selectionStatus: SELECTION_STATUS.INTERVIEW_2,
  });

  const args = {
    roomId,
    studentUserId,
    actorUserId: hr,
    previousStatus: SELECTION_STATUS.INTERVIEW_1,
    nextStatus: SELECTION_STATUS.INTERVIEW_2,
    now: NOW,
  };

  const created = notifySelectionAdvanced(db, args);

  assert.equal(created.length, 1);
  assert.equal(created[0].kind, ALERT_KIND.STUDENT_SELECTION_ADVANCED);
  assert.equal(created[0].targetUserId, studentUserId, '宛先は学生本人');

  const row = alertRows(db)[0];
  assert.equal(row.rule_code, SELECTION_STATUS.INTERVIEW_2, '冪等キーは到達したステップ');
  assert.match(row.detail, /二次面接/);
  assert.doesNotMatch(row.detail, /合格|通過/, '合否は断定しない（正式な連絡は人事が行う）');

  assert.deepEqual(notifySelectionAdvanced(db, args), [], '2回目は増えない');

  db.close();
});

test('完了済みステップのFBだけを通知する', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  // 一次面接の段階。書類は完了済み、一次面接は進行中
  const { studentUserId, roomId } = addStudent(db, {
    selectionStatus: SELECTION_STATUS.INTERVIEW_1,
  });
  addFeedback(db, studentUserId, SELECTION_STATUS.DOCUMENT, hr);
  addFeedback(db, studentUserId, SELECTION_STATUS.INTERVIEW_1, hr);

  const created = notifyVisibleFeedbacks(db, { roomId, studentUserId, actorUserId: hr, now: NOW });

  assert.equal(created.length, 1, '進行中のステップのFBは本人に見えないので通知しない');
  assert.equal(alertRows(db)[0].rule_code, SELECTION_STATUS.DOCUMENT);

  db.close();
});

test('★FBを先に書いてもステップ完了時に拾える（順序が逆でも取りこぼさない）', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const { studentUserId, roomId } = addStudent(db, {
    selectionStatus: SELECTION_STATUS.INTERVIEW_1,
  });
  addFeedback(db, studentUserId, SELECTION_STATUS.INTERVIEW_1, hr);

  // 一次面接が進行中の時点では通知されない
  assert.deepEqual(notifyVisibleFeedbacks(db, { roomId, studentUserId, now: NOW }), []);

  // 二次面接へ進めると一次面接が完了扱いになり、FBが本人に見える
  db.prepare(`UPDATE students SET selection_status = ? WHERE user_id = ?`).run(
    SELECTION_STATUS.INTERVIEW_2,
    studentUserId,
  );

  const created = notifyVisibleFeedbacks(db, { roomId, studentUserId, now: NOW });

  assert.equal(created.length, 1);
  assert.equal(created[0].kind, ALERT_KIND.STUDENT_FEEDBACK_PUBLISHED);

  db.close();
});

test('同じFBを2回保存しても通知は増えない', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const { studentUserId, roomId } = addStudent(db, {
    selectionStatus: SELECTION_STATUS.INTERVIEW_2,
  });
  addFeedback(db, studentUserId, SELECTION_STATUS.DOCUMENT, hr);

  notifyVisibleFeedbacks(db, { roomId, studentUserId, now: NOW });
  const second = notifyVisibleFeedbacks(db, { roomId, studentUserId, now: NOW });

  assert.deepEqual(second, [], '書き換えても再通知しない');
  assert.equal(alertRows(db).length, 1);

  db.close();
});

test('ルームが無ければ何もしない（room_id は NOT NULL）', () => {
  const db = createDb();
  const { studentUserId } = addStudent(db, { selectionStatus: SELECTION_STATUS.INTERVIEW_2 });

  assert.deepEqual(
    notifySelectionAdvanced(db, {
      roomId: null,
      studentUserId,
      previousStatus: SELECTION_STATUS.INTERVIEW_1,
      nextStatus: SELECTION_STATUS.INTERVIEW_2,
      now: NOW,
    }),
    [],
  );
  assert.deepEqual(notifyVisibleFeedbacks(db, { roomId: null, studentUserId, now: NOW }), []);

  db.close();
});
