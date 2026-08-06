// P4-7: 通知の読者の壁。
//
// `alerts` は人事の監視イベントと学生向けのお知らせを共用する。**混ざらないことを
// 保証しているのは alertView.js の AUDIENCE_SQL だけ**なので、ここが壊れたら
// 学生に人事の監視情報（誰の返信が遅れているか）が見えてしまう。
//
// テストは意図的に「宛先を取り違えた行」を直接 INSERT して、それでも漏れないことを見る。
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ALERT_KIND, ALERT_SEVERITY, ROLE } from '../../shared/constants.js';
import {
  countUnreadAlerts,
  countUnreadImportantAlerts,
  findAlertForUser,
  listAlertsForUser,
  markAlertRead,
  markAllAlertsRead,
} from './alertView.js';

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
      last_student_message_at TEXT
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
  `);
  return db;
}

function addUser(db, displayName, role) {
  return Number(
    db.prepare(`INSERT INTO users (display_name, role) VALUES (?, ?)`).run(displayName, role)
      .lastInsertRowid,
  );
}

function addAlert(db, { kind, targetUserId, roomId, detail = 'detail' }) {
  return Number(
    db
      .prepare(
        `INSERT INTO alerts (kind, severity, room_id, target_user_id, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(kind, ALERT_SEVERITY.WARN, roomId, targetUserId, detail, '2026-08-06T12:00:00.000Z')
      .lastInsertRowid,
  );
}

/** 人事1名・学生1名・ルーム1つの最小構成 */
function setup() {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const student = addUser(db, '田中 太郎', ROLE.STUDENT);
  const roomId = Number(
    db.prepare(`INSERT INTO rooms (student_user_id) VALUES (?)`).run(student).lastInsertRowid,
  );

  return { db, hr, student, roomId };
}

test('人事には人事向けの通知だけが返る', () => {
  const { db, hr, roomId } = setup();
  addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, targetUserId: hr, roomId });
  // ★宛先を取り違えた行（学生向けの kind を人事宛に作ってしまった想定）
  addAlert(db, { kind: ALERT_KIND.STUDENT_SELECTION_ADVANCED, targetUserId: hr, roomId });

  const alerts = listAlertsForUser(db, hr);

  assert.deepEqual(
    alerts.map((alert) => alert.kind),
    [ALERT_KIND.SLA_NOTIFY],
  );
  assert.equal(countUnreadAlerts(db, hr), 1, 'バッジの件数も一覧と一致する');

  db.close();
});

test('★学生に人事の監視イベントは返らない', () => {
  const { db, student, roomId } = setup();
  addAlert(db, { kind: ALERT_KIND.STUDENT_FEEDBACK_PUBLISHED, targetUserId: student, roomId });
  // ★宛先を取り違えた行。ここが漏れると「誰の返信が遅れているか」が学生に見える
  addAlert(db, { kind: ALERT_KIND.SLA_ESCALATE, targetUserId: student, roomId });
  addAlert(db, { kind: ALERT_KIND.INTERVIEW_ROOM_MISSING, targetUserId: student, roomId });

  const alerts = listAlertsForUser(db, student);

  assert.deepEqual(
    alerts.map((alert) => alert.kind),
    [ALERT_KIND.STUDENT_FEEDBACK_PUBLISHED],
  );
  assert.equal(countUnreadAlerts(db, student), 1);
  assert.equal(countUnreadImportantAlerts(db, student), 0, 'エスカレーションは学生の件数に入らない');

  db.close();
});

test('学生向けの通知には氏名・担当者名を載せない', () => {
  const { db, student, roomId } = setup();
  addAlert(db, { kind: ALERT_KIND.STUDENT_SELECTION_ADVANCED, targetUserId: student, roomId });

  const [alert] = listAlertsForUser(db, student);

  assert.equal(alert.studentName, null, '自分の名前は情報にならない');
  assert.equal(alert.assigneeName, null, 'FBを書いた人事が誰かは本人に伝えない');

  db.close();
});

test('人事向けの通知には学生名が載る', () => {
  const { db, hr, roomId } = setup();
  addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, targetUserId: hr, roomId });

  assert.equal(listAlertsForUser(db, hr)[0].studentName, '田中 太郎');

  db.close();
});

test('findAlertForUser は読者が違えば null（配信もされない）', () => {
  const { db, student, roomId } = setup();
  const alertId = addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, targetUserId: student, roomId });

  assert.equal(findAlertForUser(db, student, alertId), null);

  db.close();
});

test('読者が違う通知は既読にもできない', () => {
  const { db, student, hr, roomId } = setup();
  const foreign = addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, targetUserId: student, roomId });
  const own = addAlert(db, {
    kind: ALERT_KIND.STUDENT_SELECTION_ADVANCED,
    targetUserId: student,
    roomId,
  });

  assert.equal(markAlertRead(db, student, foreign), false, '存在も認めない（404 になる）');
  assert.equal(markAlertRead(db, student, own), true);

  // 一括既読も自分の読者区分だけ
  addAlert(db, { kind: ALERT_KIND.SLA_ESCALATE, targetUserId: student, roomId });
  assert.equal(markAllAlertsRead(db, student), 0, '残っているのは読者違いの1件だけ');
  assert.equal(markAllAlertsRead(db, hr), 0, '他人宛には触れない');

  db.close();
});

test('コンプライアンス記録（宛先なし）は誰の一覧にも出ない', () => {
  const { db, hr, student, roomId } = setup();
  addAlert(db, { kind: ALERT_KIND.COMPLIANCE, targetUserId: null, roomId });

  assert.deepEqual(listAlertsForUser(db, hr), []);
  assert.deepEqual(listAlertsForUser(db, student), []);

  db.close();
});

test('上長（admin）は人事向けの通知を受け取る', () => {
  const { db, roomId } = setup();
  const admin = addUser(db, '木村 誠', ROLE.ADMIN);
  addAlert(db, { kind: ALERT_KIND.SLA_ESCALATE, targetUserId: admin, roomId });

  assert.equal(listAlertsForUser(db, admin).length, 1);
  assert.equal(countUnreadImportantAlerts(db, admin), 1, 'エスカレーションは「重要」に数える');

  db.close();
});
