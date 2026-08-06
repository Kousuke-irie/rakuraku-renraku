import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  ALERT_KIND,
  HANDLING_STATUS,
  ROLE,
  SLA_ALERT_EXEMPT_STATUSES,
} from '../../shared/constants.js';
import {
  buildDetail,
  detectSlaBreaches,
  resolveSlaAlerts,
  resolveTargets,
  SLA_ESCALATE_HOURS,
  SLA_NOTIFY_HOURS,
} from './slaMonitor.js';

const NOW = Date.parse('2026-08-06T12:00:00.000Z');

/** rooms / users / messages / alerts の最小構成。制約は schema.sql と揃える */
function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_user_id INTEGER,
      handling_status TEXT NOT NULL,
      assignee_user_id INTEGER,
      last_student_message_at TEXT
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      deleted_at TEXT
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
    CREATE UNIQUE INDEX idx_alerts_sla_unique
      ON alerts(kind, room_id, trigger_message_id, target_user_id)
      WHERE kind IN ('sla_notify', 'sla_escalate');
  `);
  return db;
}

function addUser(db, displayName, role) {
  return Number(
    db.prepare(`INSERT INTO users (display_name, role) VALUES (?, ?)`).run(displayName, role)
      .lastInsertRowid,
  );
}

/** 学生の最終発言から hoursAgo 時間が経ったルームを作る */
function addRoom(db, { hoursAgo, assigneeId = null, handlingStatus = HANDLING_STATUS.NEEDS_REPLY }) {
  const studentId = addUser(db, '学生', ROLE.STUDENT);
  const at = new Date(NOW - hoursAgo * 3_600_000).toISOString();

  const roomId = Number(
    db
      .prepare(
        `INSERT INTO rooms (student_user_id, handling_status, assignee_user_id, last_student_message_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(studentId, handlingStatus, assigneeId, at).lastInsertRowid,
  );

  db.prepare(`INSERT INTO messages (room_id, sender_id) VALUES (?, ?)`).run(roomId, studentId);
  return roomId;
}

function alertRows(db) {
  return db.prepare(`SELECT * FROM alerts ORDER BY id`).all();
}

test('閾値の既定は N=24 / 2N=48', () => {
  assert.equal(SLA_NOTIFY_HOURS, 24);
  assert.equal(SLA_ESCALATE_HOURS, 48);
});

test('24時間を超えると担当者へ1件だけ通知する', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAgo: 25, assigneeId: hr });

  const created = detectSlaBreaches(db, NOW);

  assert.equal(created.length, 1);
  assert.equal(created[0].kind, ALERT_KIND.SLA_NOTIFY);
  assert.equal(created[0].targetUserId, hr);

  db.close();
});

test('23時間では通知しない（境界）', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAgo: 23.9, assigneeId: hr });

  assert.deepEqual(detectSlaBreaches(db, NOW), []);

  db.close();
});

test('★同じ入力で2回走らせても通知は増えない', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { hoursAgo: 25, assigneeId: hr });

  detectSlaBreaches(db, NOW);
  const second = detectSlaBreaches(db, NOW + 60_000);

  assert.deepEqual(second, [], '2回目は新規なし＝配信もされない');
  assert.equal(alertRows(db).length, 1, '60秒タイマーで増殖しない');

  db.close();
});

test('48時間を超えると上長へエスカレーションし、担当者宛の通知も残る', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const admin = addUser(db, '木村 誠', ROLE.ADMIN);
  addRoom(db, { hoursAgo: 49, assigneeId: hr });

  detectSlaBreaches(db, NOW);
  const rows = alertRows(db);

  assert.equal(rows.length, 2);
  const byKind = Object.fromEntries(rows.map((row) => [row.kind, row.target_user_id]));
  assert.equal(byKind[ALERT_KIND.SLA_NOTIFY], hr, '「あなたが返していない」');
  assert.equal(byKind[ALERT_KIND.SLA_ESCALATE], admin, '「担当者が返していない」');

  db.close();
});

test('★担当者が上長本人でも、通知とエスカレーションの両方が届く', () => {
  // admin も学生を担当する（monitoring.md 決定事項10）。
  // 除外すると admin が1人の構成でエスカレーションが消滅する
  const db = createDb();
  const admin = addUser(db, '木村 誠', ROLE.ADMIN);
  addRoom(db, { hoursAgo: 49, assigneeId: admin });

  detectSlaBreaches(db, NOW);
  const rows = alertRows(db);

  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.target_user_id === admin));
  assert.deepEqual(
    rows.map((row) => row.kind).sort(),
    [ALERT_KIND.SLA_ESCALATE, ALERT_KIND.SLA_NOTIFY].sort(),
  );

  db.close();
});

test('未アサインなら24時間時点で上長へ直行する', () => {
  const db = createDb();
  const admin1 = addUser(db, '木村 誠', ROLE.ADMIN);
  const admin2 = addUser(db, '別の上長', ROLE.ADMIN);
  addRoom(db, { hoursAgo: 25, assigneeId: null });

  detectSlaBreaches(db, NOW);
  const rows = alertRows(db);

  assert.equal(rows.length, 2, '上長全員に届く');
  assert.deepEqual(rows.map((row) => row.target_user_id).sort(), [admin1, admin2].sort());
  assert.ok(rows.every((row) => row.kind === ALERT_KIND.SLA_NOTIFY));

  db.close();
});

test('返信済み・完了・保留は対象外', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);

  for (const status of SLA_ALERT_EXEMPT_STATUSES) {
    addRoom(db, { hoursAgo: 99, assigneeId: hr, handlingStatus: status });
  }

  assert.deepEqual(detectSlaBreaches(db, NOW), []);

  db.close();
});

test('学生がまだ発言していないルームは対象外', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  db.prepare(
    `INSERT INTO rooms (student_user_id, handling_status, assignee_user_id, last_student_message_at)
     VALUES (NULL, ?, ?, NULL)`,
  ).run(HANDLING_STATUS.NEEDS_REPLY, hr);

  assert.deepEqual(detectSlaBreaches(db, NOW), []);

  db.close();
});

test('学生が再発言すると別イベントとして再通知される', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const roomId = addRoom(db, { hoursAgo: 25, assigneeId: hr });

  detectSlaBreaches(db, NOW);
  assert.equal(alertRows(db).length, 1);

  // 新しい学生メッセージ＝ trigger_message_id が変わる
  const studentId = db.prepare(`SELECT student_user_id AS id FROM rooms WHERE id = ?`).get(roomId).id;
  db.prepare(`INSERT INTO messages (room_id, sender_id) VALUES (?, ?)`).run(roomId, studentId);

  const created = detectSlaBreaches(db, NOW);
  assert.equal(created.length, 1, '起点が変われば正しく再通知される');
  assert.equal(alertRows(db).length, 2);

  db.close();
});

test('返信すると未解消のSLA通知が閉じる', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const roomId = addRoom(db, { hoursAgo: 49, assigneeId: hr });
  addUser(db, '木村 誠', ROLE.ADMIN);

  detectSlaBreaches(db, NOW);
  assert.equal(alertRows(db).filter((row) => !row.resolved_at).length, 2);

  const closed = resolveSlaAlerts(db, roomId, NOW);

  assert.equal(closed, 2, 'notify と escalate の両方が閉じる');
  assert.equal(alertRows(db).filter((row) => !row.resolved_at).length, 0);

  db.close();
});

test('返信の解消はコンプライアンス記録に触らない', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const roomId = addRoom(db, { hoursAgo: 25, assigneeId: hr });

  db.prepare(
    `INSERT INTO alerts (kind, severity, room_id, detail, created_at)
     VALUES (?, 'block', ?, 'x', ?)`,
  ).run(ALERT_KIND.COMPLIANCE, roomId, new Date(NOW).toISOString());

  detectSlaBreaches(db, NOW);
  resolveSlaAlerts(db, roomId, NOW);

  const compliance = alertRows(db).find((row) => row.kind === ALERT_KIND.COMPLIANCE);
  assert.equal(compliance.resolved_at, null, '起きた事実の記録は解消しない');

  db.close();
});

test('resolveTargets は経過時間で宛先を決める', () => {
  const managerIds = [10, 11];

  assert.deepEqual(resolveTargets({ elapsedHours: 1, assigneeId: 2, managerIds }), []);

  assert.deepEqual(resolveTargets({ elapsedHours: 25, assigneeId: 2, managerIds }), [
    { kind: ALERT_KIND.SLA_NOTIFY, targetUserId: 2 },
  ]);

  assert.deepEqual(resolveTargets({ elapsedHours: 49, assigneeId: 2, managerIds }), [
    { kind: ALERT_KIND.SLA_ESCALATE, targetUserId: 10 },
    { kind: ALERT_KIND.SLA_ESCALATE, targetUserId: 11 },
    { kind: ALERT_KIND.SLA_NOTIFY, targetUserId: 2 },
  ]);
});

test('detail に学生氏名と経過時間が入り、メッセージ本文は入らない', () => {
  const notify = buildDetail({
    kind: ALERT_KIND.SLA_NOTIFY,
    studentName: '田中 太郎',
    elapsedHours: 25.7,
  });
  assert.ok(notify.includes('田中 太郎'));
  assert.ok(notify.includes('25 時間'), `実際: ${notify}`);

  const escalate = buildDetail({
    kind: ALERT_KIND.SLA_ESCALATE,
    studentName: '田中 太郎',
    elapsedHours: 50,
  });
  assert.ok(escalate.includes('担当者に代わって'), '上長宛は文面が違う');

  assert.ok(
    buildDetail({ kind: ALERT_KIND.SLA_NOTIFY, studentName: null, elapsedHours: 25 }).length > 0,
    '学生名が無くても壊れない',
  );

  // デモで閾値を秒単位に短縮すると経過0時間になる。「0 時間ありません」は日本語として壊れる
  const short = buildDetail({
    kind: ALERT_KIND.SLA_NOTIFY,
    studentName: '田中 太郎',
    elapsedHours: 0.02,
  });
  assert.ok(short.includes('1 時間未満'), `実際: ${short}`);
  assert.ok(!short.includes('0 時間'));
});
