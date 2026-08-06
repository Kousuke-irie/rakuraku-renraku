import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ALERT_KIND, ROLE, SELECTION_STATUS } from '../../shared/constants.js';
import {
  buildInterviewRoomDetail,
  detectInterviewRoomGaps,
  INTERVIEW_ROOM_ALERT_LEAD_HOURS,
  resolveInterviewRoomTargets,
  resolveStaleInterviewRoomAlerts,
} from './interviewRoomMonitor.js';

const NOW = Date.parse('2026-08-06T12:00:00.000Z');

/** users / students / rooms / alerts の最小構成。制約と索引は schema.sql と揃える */
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
      selection_status TEXT NOT NULL,
      next_interview_at TEXT,
      next_interview_room TEXT
    );
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_user_id INTEGER,
      assignee_user_id INTEGER
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
    -- ★多重通知を防ぐ唯一の仕組み。ここを外すと60秒ごとに増殖する
    CREATE UNIQUE INDEX idx_alerts_interview_room_unique
      ON alerts(kind, room_id, target_user_id, rule_code)
      WHERE kind = 'interview_room_missing';
  `);
  return db;
}

function addUser(db, displayName, role) {
  return Number(
    db.prepare(`INSERT INTO users (display_name, role) VALUES (?, ?)`).run(displayName, role)
      .lastInsertRowid,
  );
}

function hoursAheadIso(hours) {
  return new Date(NOW + hours * 3_600_000).toISOString();
}

/**
 * 面接予定のあるルームを作る。
 * @returns {{roomId: number, studentId: number, interviewAt: string|null}}
 */
function addRoom(
  db,
  {
    hoursAhead = 24,
    room = null,
    assigneeId = null,
    selectionStatus = SELECTION_STATUS.INTERVIEW_1,
  } = {},
) {
  const studentId = addUser(db, '学生', ROLE.STUDENT);
  const interviewAt = hoursAhead === null ? null : hoursAheadIso(hoursAhead);

  db.prepare(
    `INSERT INTO students (user_id, selection_status, next_interview_at, next_interview_room)
     VALUES (?, ?, ?, ?)`,
  ).run(studentId, selectionStatus, interviewAt, room);

  const roomId = Number(
    db
      .prepare(`INSERT INTO rooms (student_user_id, assignee_user_id) VALUES (?, ?)`)
      .run(studentId, assigneeId).lastInsertRowid,
  );

  return { roomId, studentId, interviewAt };
}

function alertRows(db) {
  return db.prepare(`SELECT * FROM alerts ORDER BY id`).all();
}

function setRoomName(db, studentId, name) {
  db.prepare(`UPDATE students SET next_interview_room = ? WHERE user_id = ?`).run(name, studentId);
}

test('リード時間の既定は72時間', () => {
  assert.equal(INTERVIEW_ROOM_ALERT_LEAD_HOURS, 72);
});

test('面接日程があり会議室が空欄なら担当者へ1件通知する', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAhead: 26, assigneeId: hr });

  const created = detectInterviewRoomGaps(db, NOW);

  assert.equal(created.length, 1);
  assert.equal(created[0].kind, ALERT_KIND.INTERVIEW_ROOM_MISSING);
  assert.equal(created[0].targetUserId, hr);
  assert.match(alertRows(db)[0].detail, /会議室が未設定/);

  db.close();
});

test('会議室が入力済みなら通知しない（空白だけは未設定として扱う）', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAhead: 26, assigneeId: hr, room: '本社 3F 会議室A' });
  addRoom(db, { hoursAhead: 26, assigneeId: hr, room: '   ' });

  const created = detectInterviewRoomGaps(db, NOW);

  assert.equal(created.length, 1, '空白のみのルームだけが検知される');

  db.close();
});

test('面接日時が無い／過ぎている／先すぎるものは通知しない', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAhead: null, assigneeId: hr });
  addRoom(db, { hoursAhead: -1, assigneeId: hr });
  addRoom(db, { hoursAhead: INTERVIEW_ROOM_ALERT_LEAD_HOURS + 1, assigneeId: hr });

  assert.deepEqual(detectInterviewRoomGaps(db, NOW), []);

  db.close();
});

test('リード時間ちょうどは通知する（境界）', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAhead: INTERVIEW_ROOM_ALERT_LEAD_HOURS, assigneeId: hr });

  assert.equal(detectInterviewRoomGaps(db, NOW).length, 1);

  db.close();
});

test('辞退した学生は通知しない', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAhead: 26, assigneeId: hr, selectionStatus: SELECTION_STATUS.DECLINED });

  assert.deepEqual(detectInterviewRoomGaps(db, NOW), []);

  db.close();
});

test('★同じ入力で2回走らせても通知は増えない', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAhead: 26, assigneeId: hr });

  detectInterviewRoomGaps(db, NOW);
  const second = detectInterviewRoomGaps(db, NOW + 60_000);

  assert.deepEqual(second, [], '2回目は新規なし＝配信もされない');
  assert.equal(alertRows(db).length, 1);

  db.close();
});

test('未アサインのルームは上長全員へ直行する', () => {
  const db = createDb();
  const admin1 = addUser(db, '木村 誠', ROLE.ADMIN);
  const admin2 = addUser(db, '相馬 くるみ', ROLE.ADMIN);
  addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAhead: 26, assigneeId: null });

  const created = detectInterviewRoomGaps(db, NOW);

  assert.deepEqual(
    created.map((alert) => alert.targetUserId).sort(),
    [admin1, admin2].sort(),
  );

  db.close();
});

test('会議室を入力すると解消され、宛先が返る', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const { roomId, studentId } = addRoom(db, { hoursAhead: 26, assigneeId: hr });

  detectInterviewRoomGaps(db, NOW);
  setRoomName(db, studentId, '本社 5F 大会議室');

  const resolved = resolveStaleInterviewRoomAlerts(db, { roomId, now: NOW });

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].targetUserId, hr, '配信のために宛先が返る');
  assert.ok(alertRows(db)[0].resolved_at, 'resolved_at が入る');

  db.close();
});

test('日程が変わると古い通知が閉じ、新しい日時で1件立つ', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const { studentId } = addRoom(db, { hoursAhead: 26, assigneeId: hr });

  detectInterviewRoomGaps(db, NOW);
  db.prepare(`UPDATE students SET next_interview_at = ? WHERE user_id = ?`).run(
    hoursAheadIso(48),
    studentId,
  );

  assert.equal(resolveStaleInterviewRoomAlerts(db, { now: NOW }).length, 1, '古い日時の通知が閉じる');
  assert.equal(detectInterviewRoomGaps(db, NOW).length, 1, '新しい日時で改めて通知される');

  const rows = alertRows(db);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].resolved_at);
  assert.equal(rows[1].resolved_at, null);

  db.close();
});

test('面接が過ぎた通知は解消する（押しても何もできない通知を残さない）', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAhead: 2, assigneeId: hr });

  detectInterviewRoomGaps(db, NOW);
  const afterInterview = NOW + 3 * 3_600_000;

  assert.equal(resolveStaleInterviewRoomAlerts(db, { now: afterInterview }).length, 1);

  db.close();
});

test('解消済みの通知は二重に解消しない', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const { studentId } = addRoom(db, { hoursAhead: 26, assigneeId: hr });

  detectInterviewRoomGaps(db, NOW);
  setRoomName(db, studentId, 'オンライン（Zoom）');

  assert.equal(resolveStaleInterviewRoomAlerts(db, { now: NOW }).length, 1);
  assert.deepEqual(resolveStaleInterviewRoomAlerts(db, { now: NOW }), [], '2回目は対象なし');

  db.close();
});

test('resolveInterviewRoomTargets は担当者が居ればその人だけを返す', () => {
  assert.deepEqual(resolveInterviewRoomTargets({ assigneeId: 2, managerIds: [10, 11] }), [2]);
  assert.deepEqual(resolveInterviewRoomTargets({ assigneeId: null, managerIds: [10, 11] }), [10, 11]);
});

test('detail に学生氏名と残り時間が入り、閾値を短縮しても壊れない', () => {
  assert.match(
    buildInterviewRoomDetail({ studentName: '田中 太郎', remainingHours: 26.4 }),
    /田中 太郎 さんの面接まで残り 26 時間/,
  );
  assert.match(
    buildInterviewRoomDetail({ studentName: '田中 太郎', remainingHours: 0.02 }),
    /残り1時間未満/,
  );
});
