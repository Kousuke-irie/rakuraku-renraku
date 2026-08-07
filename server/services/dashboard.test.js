import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  ALERT_KIND,
  DASHBOARD_TREND_DAYS,
  HANDLING_STATUS,
  ROLE,
  SELECTION_FLOW_STEP_VALUES,
  SELECTION_PHASE,
  SELECTION_STATUS,
} from '../../shared/constants.js';
import { ACK_NOTE } from './complianceAlerts.js';
import { getDashboard } from './dashboard.js';

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
    CREATE TABLE alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL,
      room_id INTEGER NOT NULL,
      target_user_id INTEGER,
      actor_user_id INTEGER,
      trigger_message_id INTEGER,
      rule_code TEXT,
      source TEXT,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      resolved_at TEXT
    );
    -- S-12。集計そのものは hrSurveys.test.js が見るので、ここは
    -- 「回答0件でも全社の集計が形を保つ」ことだけ確かめられればよい
    CREATE TABLE hr_surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_user_id INTEGER NOT NULL UNIQUE,
      assignee_user_id INTEGER,
      outcome_status TEXT NOT NULL,
      rating_speed INTEGER NOT NULL,
      rating_clarity INTEGER NOT NULL,
      rating_courtesy INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function addUser(db, name, role) {
  return Number(
    db.prepare(`INSERT INTO users (display_name, role) VALUES (?, ?)`).run(name, role).lastInsertRowid,
  );
}

function addRoom(db, { hoursAgo = 1, assigneeId = null, handlingStatus = HANDLING_STATUS.NEEDS_REPLY, selectionStatus = SELECTION_STATUS.ENTRY } = {}) {
  const studentId = addUser(db, '学生', ROLE.STUDENT);
  db.prepare(`INSERT INTO students (user_id, selection_status) VALUES (?, ?)`).run(studentId, selectionStatus);

  return Number(
    db
      .prepare(
        `INSERT INTO rooms (student_user_id, handling_status, assignee_user_id, last_student_message_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(studentId, handlingStatus, assigneeId, new Date(NOW - hoursAgo * 3_600_000).toISOString())
      .lastInsertRowid,
  );
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

function addAlert(db, { kind, roomId, ruleCode = null, detail = 'x', daysAgo = 0, resolved = false }) {
  db.prepare(
    `INSERT INTO alerts (kind, severity, room_id, rule_code, detail, created_at, resolved_at)
     VALUES (?, 'warn', ?, ?, ?, ?, ?)`,
  ).run(
    kind,
    roomId,
    ruleCode,
    detail,
    new Date(NOW - daysAgo * 86_400_000).toISOString(),
    resolved ? new Date(NOW).toISOString() : null,
  );
}

test('KPI は未解決だけを数える', () => {
  const db = createDb();
  const room = addRoom(db, { handlingStatus: HANDLING_STATUS.NEEDS_REPLY });
  addRoom(db, { handlingStatus: HANDLING_STATUS.DONE });

  addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, roomId: room });
  addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, roomId: room, resolved: true });
  addAlert(db, { kind: ALERT_KIND.SLA_ESCALATE, roomId: room });
  addAlert(db, { kind: ALERT_KIND.COMPLIANCE, roomId: room, ruleCode: 'honseki' });

  const { kpi } = getDashboard(db, NOW);

  assert.equal(kpi.needsReply, 1);
  assert.equal(kpi.overdue24h, 1, '解消済みは数えない');
  assert.equal(kpi.escalated, 1);
  assert.equal(kpi.complianceThisWeek, 1);

  db.close();
});

test('今週のコンプラ警告は8日前を含めない', () => {
  const db = createDb();
  const room = addRoom(db);
  addAlert(db, { kind: ALERT_KIND.COMPLIANCE, roomId: room, ruleCode: 'honseki', daysAgo: 3 });
  addAlert(db, { kind: ALERT_KIND.COMPLIANCE, roomId: room, ruleCode: 'union', daysAgo: 8 });

  assert.equal(getDashboard(db, NOW).kpi.complianceThisWeek, 1);

  db.close();
});

test('★選考ステータスは有効な段階を0人でも返す（ファネルの段が抜けない）', () => {
  const db = createDb();
  addRoom(db, { selectionStatus: SELECTION_STATUS.INTERVIEW_1 });
  addRoom(db, { selectionStatus: SELECTION_STATUS.INTERVIEW_1 });
  addRoom(db, { selectionStatus: SELECTION_STATUS.OFFER });

  const { selectionBreakdown } = getDashboard(db, NOW);

  // 設定が無いときの既定は四次・五次面接が無効（selectionFlow.js の DEFAULT_DISABLED_STEPS）
  assert.deepEqual(
    selectionBreakdown.map((row) => row.status),
    [
      SELECTION_STATUS.ENTRY,
      SELECTION_STATUS.DOCUMENT,
      SELECTION_STATUS.APTITUDE,
      SELECTION_STATUS.INTERVIEW_1,
      SELECTION_STATUS.INTERVIEW_2,
      SELECTION_STATUS.INTERVIEW_3,
      SELECTION_STATUS.OFFER,
      SELECTION_STATUS.DECLINED,
    ],
    '選考フローの並び順を保ち、使っていない段階は出さない',
  );
  assert.equal(selectionBreakdown.find((r) => r.status === SELECTION_STATUS.INTERVIEW_1).count, 2);
  assert.equal(selectionBreakdown.find((r) => r.status === SELECTION_STATUS.ENTRY).count, 0);
  assert.ok(selectionBreakdown.every((row) => row.label), '表示名を必ず添える');

  // 区分は4種類。エントリーは「選考前」、内定は「確定」で、どちらも選考中ではない
  const phaseOf = (status) => selectionBreakdown.find((r) => r.status === status).phase;
  assert.equal(phaseOf(SELECTION_STATUS.ENTRY), SELECTION_PHASE.PRE);
  assert.equal(phaseOf(SELECTION_STATUS.DOCUMENT), SELECTION_PHASE.IN_PROGRESS);
  assert.equal(phaseOf(SELECTION_STATUS.INTERVIEW_3), SELECTION_PHASE.IN_PROGRESS);
  assert.equal(phaseOf(SELECTION_STATUS.OFFER), SELECTION_PHASE.SETTLED);
  assert.equal(phaseOf(SELECTION_STATUS.DECLINED), SELECTION_PHASE.EXITED);

  db.close();
});

test('★無効な段階でも学生が残っていれば出す（設定変更で学生が消えない）', () => {
  const db = createDb();
  saveSteps(db, [
    { statusKey: SELECTION_STATUS.INTERVIEW_4, isEnabled: 0 },
    { statusKey: SELECTION_STATUS.INTERVIEW_5, isEnabled: 0 },
  ]);

  addRoom(db, { selectionStatus: SELECTION_STATUS.INTERVIEW_1 });
  // 無効な段階に取り残された学生
  addRoom(db, { selectionStatus: SELECTION_STATUS.INTERVIEW_4 });

  const { selectionBreakdown } = getDashboard(db, NOW);
  const stranded = selectionBreakdown.find((r) => r.status === SELECTION_STATUS.INTERVIEW_4);

  assert.ok(stranded, '在籍者がいる段階は無効でも出す');
  assert.equal(stranded.count, 1);
  assert.equal(stranded.isEnabled, false, '標準フロー外だと分かる印を付ける');
  assert.equal(
    selectionBreakdown.find((r) => r.status === SELECTION_STATUS.INTERVIEW_5),
    undefined,
    '在籍者がいない無効な段階は出さない',
  );

  // 合計が学生数と一致する。ここがずれるとグラフの数字が信用されなくなる
  const total = selectionBreakdown.reduce((sum, row) => sum + row.count, 0);
  assert.equal(total, 2);

  db.close();
});

test('人事が付けた表示名をグラフのラベルに使う', () => {
  const db = createDb();
  saveSteps(db, [{ statusKey: SELECTION_STATUS.INTERVIEW_3, label: '最終面接' }]);
  addRoom(db, { selectionStatus: SELECTION_STATUS.INTERVIEW_3 });

  const { selectionBreakdown } = getDashboard(db, NOW);

  assert.equal(
    selectionBreakdown.find((r) => r.status === SELECTION_STATUS.INTERVIEW_3).label,
    '最終面接',
  );
  assert.equal(
    selectionBreakdown.find((r) => r.status === SELECTION_STATUS.ENTRY).label,
    'エントリー',
    '上書きが無ければ既定ラベル',
  );

  db.close();
});

test('担当者別SLAは経過時間で3段に分ける', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);

  addRoom(db, { assigneeId: hr, hoursAgo: 5 });
  addRoom(db, { assigneeId: hr, hoursAgo: 30 });
  addRoom(db, { assigneeId: hr, hoursAgo: 60 });

  const [row] = getDashboard(db, NOW).slaByAssignee;

  assert.equal(row.displayName, '大西 陽子');
  assert.equal(row.within, 1);
  assert.equal(row.over24h, 1);
  assert.equal(row.over48h, 1);

  db.close();
});

test('返信済み・完了・保留は遵守側に数える', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);

  // 99時間経っていても、人事が返信済みなら SLA 違反ではない
  addRoom(db, { assigneeId: hr, hoursAgo: 99, handlingStatus: HANDLING_STATUS.WAITING_STUDENT });
  addRoom(db, { assigneeId: hr, hoursAgo: 99, handlingStatus: HANDLING_STATUS.DONE });
  addRoom(db, { assigneeId: hr, hoursAgo: 99, handlingStatus: HANDLING_STATUS.ON_HOLD });

  const [row] = getDashboard(db, NOW).slaByAssignee;

  assert.equal(row.within, 3);
  assert.equal(row.over48h, 0);

  db.close();
});

test('未配属が先頭に来る', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  addRoom(db, { assigneeId: hr });
  addRoom(db, { assigneeId: null });

  const rows = getDashboard(db, NOW).slaByAssignee;

  assert.equal(rows[0].displayName, '未配属');
  assert.equal(rows[0].assigneeId, null);

  db.close();
});

test('★推移は件数0の日も埋めて14日分返す', () => {
  const db = createDb();
  const room = addRoom(db);
  addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, roomId: room, daysAgo: 2 });
  addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, roomId: room, daysAgo: 2 });

  const { slaTrend } = getDashboard(db, NOW);

  assert.equal(slaTrend.length, DASHBOARD_TREND_DAYS, '0件の日が抜けると日付軸がずれる');
  assert.equal(slaTrend.at(-1).date, '2026-08-06', '最終日は今日');
  assert.equal(slaTrend.find((d) => d.date === '2026-08-04').count, 2);
  assert.equal(slaTrend.find((d) => d.date === '2026-08-05').count, 0);

  // 日付が昇順に並んでいる
  const dates = slaTrend.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort());

  db.close();
});

test('コンプラ内訳は多い順、無視して送信は別で数える', () => {
  const db = createDb();
  const room = addRoom(db);

  addAlert(db, { kind: ALERT_KIND.COMPLIANCE, roomId: room, ruleCode: 'honseki', detail: `x｜${ACK_NOTE.ACKNOWLEDGED}` });
  addAlert(db, { kind: ALERT_KIND.COMPLIANCE, roomId: room, ruleCode: 'honseki', detail: `x｜${ACK_NOTE.UNCHECKED}` });
  addAlert(db, { kind: ALERT_KIND.COMPLIANCE, roomId: room, ruleCode: 'union', detail: `x｜${ACK_NOTE.UNCHECKED}` });
  // SLA には rule_code が無いので内訳に混ざらない
  addAlert(db, { kind: ALERT_KIND.SLA_NOTIFY, roomId: room });

  const { complianceBreakdown, complianceIgnored } = getDashboard(db, NOW);

  // 画面にコードを出さないので日本語ラベルが付く。AI 由来の件数も分けて返す
  assert.deepEqual(
    complianceBreakdown.map((row) => [row.ruleCode, row.label, row.count, row.aiCount]),
    [
      ['honseki', '本籍・出生地', 2, 0],
      ['union', '労働組合・学生運動', 1, 0],
    ],
  );
  assert.equal(complianceIgnored, 1, '警告を承知で送信した件数だけ');

  db.close();
});

test('エスカレーション中の案件は経過の長い順、1ルーム1行', () => {
  const db = createDb();
  const hr = addUser(db, '大西 陽子', ROLE.HR);
  const roomA = addRoom(db, { assigneeId: hr, hoursAgo: 50 });
  const roomB = addRoom(db, { assigneeId: hr, hoursAgo: 70 });
  const roomC = addRoom(db, { assigneeId: hr, hoursAgo: 90 });

  // 上長が2人いると同じルームに2件立つが、表は1行にまとめる
  addAlert(db, { kind: ALERT_KIND.SLA_ESCALATE, roomId: roomA });
  addAlert(db, { kind: ALERT_KIND.SLA_ESCALATE, roomId: roomA });
  addAlert(db, { kind: ALERT_KIND.SLA_ESCALATE, roomId: roomB });
  addAlert(db, { kind: ALERT_KIND.SLA_ESCALATE, roomId: roomC, resolved: true });

  const { escalations } = getDashboard(db, NOW);

  assert.equal(escalations.length, 2, '解消済みは出ない／同一ルームは1行');
  assert.deepEqual(escalations.map((e) => e.roomId), [roomB, roomA], '経過の長い順');
  assert.equal(escalations[0].assigneeName, '大西 陽子');

  db.close();
});

test('データが空でも形が崩れない', () => {
  const db = createDb();
  const result = getDashboard(db, NOW);

  assert.deepEqual(result.kpi, { needsReply: 0, overdue24h: 0, escalated: 0, complianceThisWeek: 0 });
  // 既定で有効な7段階 + 辞退。学生が0人でもファネルの段は消さない
  assert.equal(result.selectionBreakdown.length, 8);
  assert.deepEqual(result.slaByAssignee, []);
  assert.equal(result.slaTrend.length, DASHBOARD_TREND_DAYS);
  assert.deepEqual(result.complianceBreakdown, []);
  assert.equal(result.complianceIgnored, 0);
  assert.deepEqual(result.escalations, []);

  db.close();
});
