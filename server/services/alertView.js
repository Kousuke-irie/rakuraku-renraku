// P4-1: 通知一覧の取得・既読化。
//
// 自分宛（target_user_id = 自分）の通知だけを扱う。
// コンプライアンス警告は target_user_id が NULL なのでここには出ない
// （本人へは送信前ダイアログで伝え、集計はダッシュボード P4-4 が担う）。
import { SLA_ALERT_KINDS } from '../../shared/constants.js';

const ALERT_SELECT_SQL = `
  SELECT
    a.id,
    a.kind,
    a.severity,
    a.room_id       AS roomId,
    a.detail,
    a.created_at    AS createdAt,
    a.read_at       AS readAt,
    a.resolved_at   AS resolvedAt,
    su.display_name AS studentName,
    au.display_name AS assigneeName,
    r.last_student_message_at AS lastStudentMessageAt
  FROM alerts a
  JOIN rooms r ON r.id = a.room_id
  LEFT JOIN users su ON su.id = r.student_user_id
  LEFT JOIN users au ON au.id = a.actor_user_id
`;

function elapsedHours(isoString) {
  if (!isoString) return null;
  return Math.round(((Date.now() - new Date(isoString).getTime()) / 3_600_000) * 10) / 10;
}

export function toAlert(row) {
  if (!row) return null;

  return {
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    roomId: row.roomId,
    studentName: row.studentName,
    assigneeName: row.assigneeName,
    detail: row.detail,
    createdAt: row.createdAt,
    readAt: row.readAt,
    resolvedAt: row.resolvedAt,
    elapsedHours: elapsedHours(row.lastStudentMessageAt),
  };
}

/**
 * 自分宛の通知を新しい順に返す。
 *
 * 既定では**解消済みを含めない**。返信して片付いた通知が一覧に残り続けると、
 * 「上から処理すれば終わる」というコンセプトが崩れるため。
 *
 * @param {{unreadOnly?: boolean, includeResolved?: boolean, limit?: number}} options
 */
export function listAlertsForUser(db, userId, options = {}) {
  const { unreadOnly = false, includeResolved = false, limit = 50 } = options;

  return db
    .prepare(
      `${ALERT_SELECT_SQL}
        WHERE a.target_user_id = @userId
          AND (@unreadOnly = 0 OR a.read_at IS NULL)
          AND (@includeResolved = 1 OR a.resolved_at IS NULL)
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT @limit`,
    )
    .all({
      userId,
      unreadOnly: unreadOnly ? 1 : 0,
      includeResolved: includeResolved ? 1 : 0,
      limit,
    })
    .map(toAlert);
}

/** ナビレールのバッジ用。未読かつ未解消の件数。 */
export function countUnreadAlerts(db, userId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS count
         FROM alerts
        WHERE target_user_id = ?
          AND read_at IS NULL
          AND resolved_at IS NULL`,
    )
    .get(userId).count;
}

export function findAlertForUser(db, userId, alertId) {
  return toAlert(
    db.prepare(`${ALERT_SELECT_SQL} WHERE a.id = ? AND a.target_user_id = ?`).get(alertId, userId),
  );
}

/**
 * 既読にする。**自分宛のものしか更新できない**（CLAUDE.md §6-6）。
 * @returns {boolean} 対象が存在して更新できたか
 */
export function markAlertRead(db, userId, alertId, now = Date.now()) {
  const result = db
    .prepare(
      `UPDATE alerts
          SET read_at = ?
        WHERE id = ? AND target_user_id = ? AND read_at IS NULL`,
    )
    .run(new Date(now).toISOString(), alertId, userId);

  if (result.changes > 0) return true;

  // 既に既読でも「存在はする」なら成功扱いにする（二重クリックで404にしない）
  return Boolean(
    db.prepare(`SELECT 1 FROM alerts WHERE id = ? AND target_user_id = ?`).get(alertId, userId),
  );
}

/** @returns {number} 既読にした件数 */
export function markAllAlertsRead(db, userId, now = Date.now()) {
  return db
    .prepare(
      `UPDATE alerts
          SET read_at = ?
        WHERE target_user_id = ? AND read_at IS NULL AND resolved_at IS NULL`,
    )
    .run(new Date(now).toISOString(), userId).changes;
}

export { SLA_ALERT_KINDS };
