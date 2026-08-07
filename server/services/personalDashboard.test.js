import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  AI_ANALYSIS_STATUS,
  AI_RECOMMENDED_PRIORITY,
  HANDLING_STATUS,
  HANDLING_STATUS_VALUES,
  HOURS_IN_DAY,
  MESSAGE_TYPE,
  REPLY_STATE,
  ROLE,
  SELECTION_FLOW_STEP_VALUES,
  SELECTION_STATUS,
  URGENCY,
} from '../../shared/constants.js';
import { findAssignee, getPersonalDashboard } from './personalDashboard.js';

const NOW = Date.parse('2026-08-06T12:00:00.000Z');

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
      handling_status TEXT NOT NULL,
      assignee_user_id INTEGER,
      urgency TEXT NOT NULL DEFAULT 'normal',
      ai_priority TEXT,
      ai_analysis_status TEXT NOT NULL DEFAULT 'skipped',
      last_student_message_at TEXT
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
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);
  return db;
}

const iso = (hoursAgo) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

function addUser(db, name, role) {
  return Number(
    db.prepare(`INSERT INTO users (display_name, role) VALUES (?, ?)`).run(name, role).lastInsertRowid,
  );
}

function addRoom(
  db,
  {
    assigneeId,
    handlingStatus = HANDLING_STATUS.NEEDS_REPLY,
    selectionStatus = SELECTION_STATUS.ENTRY,
    urgency = URGENCY.NORMAL,
    aiPriority = null,
    aiAnalysisStatus = AI_ANALYSIS_STATUS.SKIPPED,
    lastStudentHoursAgo = 1,
  } = {},
) {
  const studentId = addUser(db, '学生', ROLE.STUDENT);
  db.prepare(`INSERT INTO students (user_id, selection_status) VALUES (?, ?)`).run(
    studentId,
    selectionStatus,
  );

  const roomId = Number(
    db
      .prepare(
        `INSERT INTO rooms
           (student_user_id, handling_status, assignee_user_id, urgency,
            ai_priority, ai_analysis_status, last_student_message_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        studentId,
        handlingStatus,
        assigneeId,
        urgency,
        aiPriority,
        aiAnalysisStatus,
        lastStudentHoursAgo === null ? null : iso(lastStudentHoursAgo),
      ).lastInsertRowid,
  );

  return { roomId, studentId };
}

function addMessage(db, { roomId, senderId, hoursAgo, type = MESSAGE_TYPE.TEXT, deleted = false }) {
  db.prepare(
    `INSERT INTO messages (room_id, sender_id, body, type, created_at, deleted_at)
     VALUES (?, ?, 'x', ?, ?, ?)`,
  ).run(roomId, senderId, type, iso(hoursAgo), deleted ? iso(0) : null);
}

function setupHr(db) {
  return addUser(db, '大西 陽子', ROLE.HR);
}

/**
 * 選考フロー設定を書き込む。
 * ★1件でも行があると既定値へのフォールバックが止まる（selectionFlow.js）ので、
 *   全ステップを書いたうえで overrides を当てる。
 */
function saveSteps(db, overrides = []) {
  const byKey = new Map(overrides.map((item) => [item.statusKey, item]));

  SELECTION_FLOW_STEP_VALUES.forEach((statusKey, index) => {
    const override = byKey.get(statusKey) ?? {};

    db.prepare(
      `INSERT INTO selection_steps (status_key, is_enabled, sort_order, label, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      statusKey,
      override.isEnabled ?? 1,
      override.sortOrder ?? index,
      override.label ?? null,
      new Date(NOW).toISOString(),
    );
  });
}

// --- 担当者の解決 -----------------------------------------------------------

test('人事以外の id では担当者として解決しない', () => {
  const db = createDb();
  const hrId = setupHr(db);
  const adminId = addUser(db, '上長', ROLE.ADMIN);
  const studentId = addUser(db, '学生', ROLE.STUDENT);

  assert.equal(findAssignee(db, hrId).displayName, '大西 陽子');
  assert.equal(findAssignee(db, adminId).id, adminId, 'admin も担当者になれる');
  assert.equal(findAssignee(db, studentId), null);
  assert.equal(findAssignee(db, 9999), null);

  db.close();
});

// --- 母数の分離 -------------------------------------------------------------

test('他人の担当ルームは母数に入らない', () => {
  const db = createDb();
  const mine = setupHr(db);
  const others = addUser(db, '別担当', ROLE.HR);

  addRoom(db, { assigneeId: mine });
  addRoom(db, { assigneeId: mine });
  addRoom(db, { assigneeId: others });
  addRoom(db, { assigneeId: null });

  assert.equal(getPersonalDashboard(db, mine, NOW).kpi.assignedStudents, 2);

  db.close();
});

// --- 構成比 -----------------------------------------------------------------

test('対応ステータスは0件の分類も返す', () => {
  const db = createDb();
  const hrId = setupHr(db);
  addRoom(db, { assigneeId: hrId, handlingStatus: HANDLING_STATUS.NEEDS_REPLY });
  addRoom(db, { assigneeId: hrId, handlingStatus: HANDLING_STATUS.DONE });

  const { handlingBreakdown } = getPersonalDashboard(db, hrId, NOW);

  assert.deepEqual(
    handlingBreakdown.map((row) => row.status),
    HANDLING_STATUS_VALUES,
    '5分類すべてを固定順で返す',
  );
  assert.equal(handlingBreakdown.find((row) => row.status === HANDLING_STATUS.NEEDS_REPLY).count, 1);
  assert.equal(handlingBreakdown.find((row) => row.status === HANDLING_STATUS.ON_HOLD).count, 0);

  db.close();
});

test('AI推奨度は未判定なら緊急度に落ちる。aiCount はAI判定ぶんだけ', () => {
  const db = createDb();
  const hrId = setupHr(db);

  // AI 判定済み → ai_priority を採用
  addRoom(db, {
    assigneeId: hrId,
    aiPriority: AI_RECOMMENDED_PRIORITY.HIGH,
    aiAnalysisStatus: AI_ANALYSIS_STATUS.COMPLETED,
    urgency: URGENCY.LOW,
  });
  // AI 失敗 → urgency にフォールバック
  addRoom(db, {
    assigneeId: hrId,
    aiPriority: AI_RECOMMENDED_PRIORITY.LOW,
    aiAnalysisStatus: AI_ANALYSIS_STATUS.FAILED,
    urgency: URGENCY.HIGH,
  });
  // 未実施 → urgency
  addRoom(db, { assigneeId: hrId, urgency: URGENCY.NORMAL });

  const { aiPriorityBreakdown } = getPersonalDashboard(db, hrId, NOW);
  const high = aiPriorityBreakdown.find((row) => row.priority === AI_RECOMMENDED_PRIORITY.HIGH);

  assert.equal(high.count, 2, '判定済みの高 + フォールバックの高');
  assert.equal(high.aiCount, 1, 'AI が決めたのは1件だけ');
  assert.equal(
    aiPriorityBreakdown.find((row) => row.priority === AI_RECOMMENDED_PRIORITY.LOW).count,
    0,
    '失敗した ai_priority=low は採用しない',
  );

  db.close();
});

test('返信状況は対応ステータスではなく時刻で決まる', () => {
  const db = createDb();
  const hrId = setupHr(db);

  // 対応中のまま48時間放置 → 未返信（閾値超）
  const stale = addRoom(db, {
    assigneeId: hrId,
    handlingStatus: HANDLING_STATUS.IN_PROGRESS,
    lastStudentHoursAgo: 48,
  });
  addMessage(db, { roomId: stale.roomId, senderId: hrId, hoursAgo: 72 });

  // 要返信だが学生の発言の後に人事が返している → 返信済み
  const replied = addRoom(db, {
    assigneeId: hrId,
    handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    lastStudentHoursAgo: 5,
  });
  addMessage(db, { roomId: replied.roomId, senderId: hrId, hoursAgo: 4 });

  // 未返信だが閾値内
  addRoom(db, { assigneeId: hrId, lastStudentHoursAgo: 2 });

  // 学生がまだ発言していない
  addRoom(db, { assigneeId: hrId, lastStudentHoursAgo: null });

  const counts = Object.fromEntries(
    getPersonalDashboard(db, hrId, NOW).replyStateBreakdown.map((row) => [row.state, row.count]),
  );

  assert.equal(counts[REPLY_STATE.OVERDUE], 1);
  assert.equal(counts[REPLY_STATE.REPLIED], 2, '返信済み + 学生未発言');
  assert.equal(counts[REPLY_STATE.WAITING], 1);

  db.close();
});

test('選考ステータスは選考フローの設定に従う（使っていない段階は出さない）', () => {
  const db = createDb();
  const hrId = setupHr(db);
  saveSteps(db, [
    { statusKey: SELECTION_STATUS.INTERVIEW_3, isEnabled: 0 },
    { statusKey: SELECTION_STATUS.INTERVIEW_4, isEnabled: 0 },
    { statusKey: SELECTION_STATUS.INTERVIEW_5, isEnabled: 0 },
  ]);
  addRoom(db, { assigneeId: hrId, selectionStatus: SELECTION_STATUS.INTERVIEW_1 });

  const { selectionBreakdown } = getPersonalDashboard(db, hrId, NOW);

  assert.deepEqual(
    selectionBreakdown.map((row) => row.status),
    [
      SELECTION_STATUS.ENTRY,
      SELECTION_STATUS.DOCUMENT,
      SELECTION_STATUS.APTITUDE,
      SELECTION_STATUS.INTERVIEW_1,
      SELECTION_STATUS.INTERVIEW_2,
      SELECTION_STATUS.OFFER,
      SELECTION_STATUS.DECLINED,
    ],
  );
  assert.equal(
    selectionBreakdown.find((row) => row.status === SELECTION_STATUS.INTERVIEW_1).count,
    1,
  );
  assert.ok(selectionBreakdown.every((row) => row.phase));
  assert.ok(selectionBreakdown.every((row) => row.label));

  db.close();
});

test('無効な段階でも担当学生が残っていれば出す。並び順は設定に従う', () => {
  const db = createDb();
  const hrId = setupHr(db);
  saveSteps(db, [{ statusKey: SELECTION_STATUS.INTERVIEW_4, isEnabled: 0 }]);

  addRoom(db, { assigneeId: hrId, selectionStatus: SELECTION_STATUS.INTERVIEW_4 });
  addRoom(db, { assigneeId: hrId, selectionStatus: SELECTION_STATUS.OFFER });

  const { selectionBreakdown, kpi } = getPersonalDashboard(db, hrId, NOW);
  const stranded = selectionBreakdown.find((row) => row.status === SELECTION_STATUS.INTERVIEW_4);

  assert.equal(stranded.count, 1);
  assert.equal(stranded.isEnabled, false);
  // 四次面接は内定より前。設定の sort_order の位置に入る
  assert.ok(
    selectionBreakdown.findIndex((row) => row.status === SELECTION_STATUS.INTERVIEW_4) <
      selectionBreakdown.findIndex((row) => row.status === SELECTION_STATUS.OFFER),
  );

  // 合計が担当学生数と一致する。ここがずれるとグラフの数字が信用されなくなる
  const total = selectionBreakdown.reduce((sum, row) => sum + row.count, 0);
  assert.equal(total, kpi.assignedStudents);

  db.close();
});

// --- 時間帯別 ---------------------------------------------------------------

test('時間帯別は24点すべてを UTC の時刻で返す', () => {
  const db = createDb();
  const hrId = setupHr(db);
  const { roomId, studentId } = addRoom(db, { assigneeId: hrId });

  // NOW は 12:00 UTC。3時間前 = 09:00 UTC
  addMessage(db, { roomId, senderId: studentId, hoursAgo: 3 });
  addMessage(db, { roomId, senderId: studentId, hoursAgo: 3 });
  addMessage(db, { roomId, senderId: hrId, hoursAgo: 0 });
  // システムメッセージと削除済みは数えない
  addMessage(db, { roomId, senderId: hrId, hoursAgo: 0, type: MESSAGE_TYPE.SYSTEM });
  addMessage(db, { roomId, senderId: hrId, hoursAgo: 0, deleted: true });

  const { hourlyActivity } = getPersonalDashboard(db, hrId, NOW);

  assert.equal(hourlyActivity.length, HOURS_IN_DAY);
  assert.deepEqual(
    hourlyActivity.map((row) => row.hourUtc),
    Array.from({ length: HOURS_IN_DAY }, (_, index) => index),
  );
  assert.equal(hourlyActivity[9].studentCount, 2);
  assert.equal(hourlyActivity[9].hrCount, 0);
  assert.equal(hourlyActivity[12].hrCount, 1, 'システム・削除済みは除外');
  assert.equal(hourlyActivity[0].studentCount, 0);

  db.close();
});

// --- 返信所要時間 -----------------------------------------------------------

test('所要時間は学生の連続発言の先頭から測る', () => {
  const db = createDb();
  const hrId = setupHr(db);
  const { roomId, studentId } = addRoom(db, { assigneeId: hrId, lastStudentHoursAgo: 8 });

  // 学生が3通続けて送り（10h前・9h前・8h前）、人事が 4h 前に返信
  addMessage(db, { roomId, senderId: studentId, hoursAgo: 10 });
  addMessage(db, { roomId, senderId: studentId, hoursAgo: 9 });
  addMessage(db, { roomId, senderId: studentId, hoursAgo: 8 });
  addMessage(db, { roomId, senderId: hrId, hoursAgo: 4 });

  const { replyLatency } = getPersonalDashboard(db, hrId, NOW);

  assert.equal(replyLatency.sampleSize, 1, '3通まとめて1件の返信ペア');
  assert.equal(replyLatency.medianHours, 6, '最後の1通(4h)ではなく先頭から測る');
  assert.equal(replyLatency.buckets.find((row) => row.key === 'h6_12').count, 1);

  db.close();
});

test('未返信のやり取りは所要時間に含めない', () => {
  const db = createDb();
  const hrId = setupHr(db);
  const { roomId, studentId } = addRoom(db, { assigneeId: hrId, lastStudentHoursAgo: 2 });

  addMessage(db, { roomId, senderId: studentId, hoursAgo: 2 });

  const { replyLatency } = getPersonalDashboard(db, hrId, NOW);

  assert.equal(replyLatency.sampleSize, 0);
  assert.equal(replyLatency.medianHours, null);
  assert.equal(replyLatency.averageHours, null);
  assert.equal(replyLatency.buckets.length, 6, '母数0でもバケットの形は変えない');

  db.close();
});

test('中央値は外れ値に引っ張られない（平均とは別の値になる）', () => {
  const db = createDb();
  const hrId = setupHr(db);

  // 0.5h / 1h / 100h の3件 → 中央値 1h、平均 33.8h
  const cases = [
    { asked: 100.5, replied: 100 },
    { asked: 50, replied: 49 },
    { asked: 200, replied: 100 },
  ];

  for (const { asked, replied } of cases) {
    const { roomId, studentId } = addRoom(db, { assigneeId: hrId, lastStudentHoursAgo: asked });
    addMessage(db, { roomId, senderId: studentId, hoursAgo: asked });
    addMessage(db, { roomId, senderId: hrId, hoursAgo: replied });
  }

  const { replyLatency, kpi } = getPersonalDashboard(db, hrId, NOW);

  assert.equal(replyLatency.sampleSize, 3);
  assert.equal(replyLatency.medianHours, 1);
  assert.equal(replyLatency.averageHours, 33.8);
  assert.equal(kpi.replyMedianHours, 1, 'KPI には中央値を出す');
  assert.equal(replyLatency.buckets.find((row) => row.key === 'over_24h').count, 1);

  db.close();
});

test('担当ルームが0件でも形の揃った空の集計を返す', () => {
  const db = createDb();
  const hrId = setupHr(db);

  const result = getPersonalDashboard(db, hrId, NOW);

  assert.equal(result.kpi.assignedStudents, 0);
  assert.equal(result.kpi.replyMedianHours, null);
  assert.equal(result.handlingBreakdown.length, HANDLING_STATUS_VALUES.length);
  // 既定で有効な7段階 + 辞退。学生が0人でもファネルの段は消さない
  assert.equal(result.selectionBreakdown.length, 8);
  assert.equal(result.hourlyActivity.length, HOURS_IN_DAY);
  assert.ok(result.thresholds.notifyHours > 0);

  db.close();
});
