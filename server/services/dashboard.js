// P4-4: 監視ダッシュボードの集計。
//
// 1リクエスト＝複数クエリでよい（SQLite なのでラウンドトリップが無い）。
// リアルタイム更新はしない。alerts が動くたびに再集計するのは割に合わない。
import {
  ALERT_KIND,
  DASHBOARD_TREND_DAYS,
  HANDLING_STATUS,
  ROLE,
  SELECTION_STATUS,
  SELECTION_STATUS_VALUES,
} from '../../shared/constants.js';
import { ACK_NOTE } from './complianceAlerts.js';
import { SLA_ESCALATE_HOURS, SLA_NOTIFY_HOURS } from './slaMonitor.js';

/** KPI「今週のコンプラ警告」の対象期間 */
const COMPLIANCE_WINDOW_DAYS = 7;

function isoDaysAgo(now, days) {
  return new Date(now - days * 86_400_000).toISOString();
}

function buildKpi(db, now) {
  const needsReply = db
    .prepare(`SELECT COUNT(*) AS count FROM rooms WHERE handling_status = ?`)
    .get(HANDLING_STATUS.NEEDS_REPLY).count;

  // 未解決＝まだ返信されていない。解消済みを数えると「対応済みなのに赤い」状態になる
  const openByKind = (kind) =>
    db
      .prepare(`SELECT COUNT(*) AS count FROM alerts WHERE kind = ? AND resolved_at IS NULL`)
      .get(kind).count;

  const complianceThisWeek = db
    .prepare(`SELECT COUNT(*) AS count FROM alerts WHERE kind = ? AND created_at >= ?`)
    .get(ALERT_KIND.COMPLIANCE, isoDaysAgo(now, COMPLIANCE_WINDOW_DAYS)).count;

  return {
    needsReply,
    overdue24h: openByKind(ALERT_KIND.SLA_NOTIFY),
    escalated: openByKind(ALERT_KIND.SLA_ESCALATE),
    complianceThisWeek,
  };
}

/**
 * 選考ステータス別の学生数。
 * **0人の段階も返す。** 欠けるとファネルの段が抜けて読めなくなる。
 */
function buildSelectionBreakdown(db) {
  const counts = new Map(
    db
      .prepare(`SELECT selection_status AS status, COUNT(*) AS count FROM students GROUP BY selection_status`)
      .all()
      .map((row) => [row.status, row.count]),
  );

  return SELECTION_STATUS_VALUES.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
    // 辞退は進行段階ではなく離脱。グラフ側で罫線を挟んで別扱いにする
    isExit: status === SELECTION_STATUS.DECLINED,
  }));
}

/**
 * 担当者別の SLA 遵守状況。
 *
 * 経過時間は**いまこの瞬間**の値で数える（alerts の履歴ではない）。
 * 「現在どれだけ滞留しているか」を見る指標なので、過去に一度超えたが返信済みの
 * ルームは `within` に入るのが正しい。
 */
function buildSlaByAssignee(db, now) {
  const rows = db
    .prepare(
      `SELECT
         r.assignee_user_id AS assigneeId,
         u.display_name     AS displayName,
         r.handling_status  AS handlingStatus,
         r.last_student_message_at AS lastStudentMessageAt
       FROM rooms r
       LEFT JOIN users u ON u.id = r.assignee_user_id`,
    )
    .all();

  const byAssignee = new Map();

  for (const row of rows) {
    const key = row.assigneeId ?? 0;
    if (!byAssignee.has(key)) {
      byAssignee.set(key, {
        assigneeId: row.assigneeId,
        displayName: row.displayName ?? '未配属',
        within: 0,
        over24h: 0,
        over48h: 0,
      });
    }

    const bucket = byAssignee.get(key);
    const elapsed = row.lastStudentMessageAt
      ? (now - new Date(row.lastStudentMessageAt).getTime()) / 3_600_000
      : 0;

    // 返信済み・完了・保留は SLA の対象外なので「遵守」側に数える
    const exempt = ![HANDLING_STATUS.NEEDS_REPLY, HANDLING_STATUS.IN_PROGRESS].includes(
      row.handlingStatus,
    );

    if (exempt || elapsed < SLA_NOTIFY_HOURS) bucket.within += 1;
    else if (elapsed < SLA_ESCALATE_HOURS) bucket.over24h += 1;
    else bucket.over48h += 1;
  }

  // 未配属を先頭に。以降は担当者名順（S-08 と同じ並び）
  return [...byAssignee.values()].sort((a, b) => {
    if (a.assigneeId === null) return -1;
    if (b.assigneeId === null) return 1;
    return a.displayName.localeCompare(b.displayName, 'ja');
  });
}

/**
 * SLA 違反の発生推移（直近 DASHBOARD_TREND_DAYS 日）。
 *
 * **件数0の日をサーバ側で埋める。** GROUP BY だけだと0件の日が行ごと消えて、
 * グラフの日付軸が詰まってずれる。
 */
function buildSlaTrend(db, now) {
  const since = isoDaysAgo(now, DASHBOARD_TREND_DAYS - 1);

  const counts = new Map(
    db
      .prepare(
        `SELECT date(created_at) AS date, COUNT(*) AS count
           FROM alerts
          WHERE kind = ? AND created_at >= ?
          GROUP BY date(created_at)`,
      )
      .all(ALERT_KIND.SLA_NOTIFY, since)
      .map((row) => [row.date, row.count]),
  );

  const trend = [];
  for (let offset = DASHBOARD_TREND_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * 86_400_000).toISOString().slice(0, 10);
    trend.push({ date, count: counts.get(date) ?? 0 });
  }

  return trend;
}

function buildComplianceBreakdown(db) {
  return db
    .prepare(
      `SELECT rule_code AS ruleCode, COUNT(*) AS count
         FROM alerts
        WHERE kind = ? AND rule_code IS NOT NULL
        GROUP BY rule_code
        ORDER BY count DESC, rule_code ASC`,
    )
    .all(ALERT_KIND.COMPLIANCE);
}

/**
 * 警告を見たうえで送信された件数。
 * **この指標がコンプライアンス機能の価値そのもの。** 他社ツールには無い。
 */
function countComplianceIgnored(db) {
  return db
    .prepare(`SELECT COUNT(*) AS count FROM alerts WHERE kind = ? AND detail LIKE ?`)
    .get(ALERT_KIND.COMPLIANCE, `%${ACK_NOTE.ACKNOWLEDGED}`).count;
}

/** 上長が対応を検討すべき案件。経過時間の長い順 */
function buildEscalations(db, now) {
  return db
    .prepare(
      `SELECT DISTINCT
         a.room_id       AS roomId,
         su.display_name AS studentName,
         au.display_name AS assigneeName,
         st.selection_status AS selectionStatus,
         r.last_student_message_at AS lastStudentMessageAt,
         MIN(a.created_at) AS createdAt
       FROM alerts a
       JOIN rooms r ON r.id = a.room_id
       LEFT JOIN users su ON su.id = r.student_user_id
       LEFT JOIN students st ON st.user_id = su.id
       LEFT JOIN users au ON au.id = r.assignee_user_id
       WHERE a.kind = ? AND a.resolved_at IS NULL
       GROUP BY a.room_id`,
    )
    .all(ALERT_KIND.SLA_ESCALATE)
    .map((row) => ({
      roomId: row.roomId,
      studentName: row.studentName,
      assigneeName: row.assigneeName,
      selectionStatus: row.selectionStatus,
      createdAt: row.createdAt,
      elapsedHours: row.lastStudentMessageAt
        ? Math.round(((now - new Date(row.lastStudentMessageAt).getTime()) / 3_600_000) * 10) / 10
        : null,
    }))
    .sort((a, b) => (b.elapsedHours ?? 0) - (a.elapsedHours ?? 0));
}

export function getDashboard(db, now = Date.now()) {
  return {
    kpi: buildKpi(db, now),
    selectionBreakdown: buildSelectionBreakdown(db),
    slaByAssignee: buildSlaByAssignee(db, now),
    slaTrend: buildSlaTrend(db, now),
    complianceBreakdown: buildComplianceBreakdown(db),
    complianceIgnored: countComplianceIgnored(db),
    escalations: buildEscalations(db, now),
    thresholds: { notifyHours: SLA_NOTIFY_HOURS, escalateHours: SLA_ESCALATE_HOURS },
  };
}

export { ROLE };
