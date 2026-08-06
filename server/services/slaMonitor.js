// P4-1: SLA監視・段階エスカレーション。
//
// 学生の最終発言から N=24h で担当者へ、2N=48h で上長へ通知する。
//
// ★多重通知を防ぐのは alerts の部分UNIQUEインデックス（idx_alerts_sla_unique）だけ。
//   60秒タイマーから何度呼ばれても INSERT OR IGNORE で弾かれる。
//   アプリ側に「通知済みかどうか」の状態を持たせないこと。
import {
  ALERT_KIND,
  ALERT_SEVERITY,
  ROLE,
  SLA_ALERT_EXEMPT_STATUSES,
  SLA_ALERT_KINDS,
  SLA_ESCALATE_HOURS as DEFAULT_SLA_ESCALATE_HOURS,
  SLA_NOTIFY_HOURS as DEFAULT_SLA_NOTIFY_HOURS,
} from '../../shared/constants.js';

function envHours(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const SLA_NOTIFY_HOURS = envHours('SLA_NOTIFY_HOURS', DEFAULT_SLA_NOTIFY_HOURS);
export const SLA_ESCALATE_HOURS = envHours('SLA_ESCALATE_HOURS', DEFAULT_SLA_ESCALATE_HOURS);

const EXEMPT_PLACEHOLDERS = SLA_ALERT_EXEMPT_STATUSES.map(() => '?').join(', ');

/**
 * 監視対象のルーム。
 * 人事が返信済み（waiting_student / done）と、意図的に止めた保留（on_hold）は外す。
 */
const TARGET_ROOMS_SQL = `
  SELECT
    r.id                                   AS roomId,
    r.assignee_user_id                     AS assigneeId,
    r.last_student_message_at              AS lastStudentMessageAt,
    su.display_name                        AS studentName,
    (
      SELECT m.id
      FROM messages m
      WHERE m.room_id = r.id
        AND m.sender_id = r.student_user_id
        AND m.deleted_at IS NULL
      ORDER BY m.id DESC
      LIMIT 1
    ) AS triggerMessageId
  FROM rooms r
  LEFT JOIN users su ON su.id = r.student_user_id
  WHERE r.last_student_message_at IS NOT NULL
    AND r.handling_status NOT IN (${EXEMPT_PLACEHOLDERS})
`;

const INSERT_SQL = `
  INSERT OR IGNORE INTO alerts
    (kind, severity, room_id, target_user_id, actor_user_id, trigger_message_id, rule_code, detail, created_at)
  VALUES
    (@kind, @severity, @roomId, @targetUserId, @actorUserId, @triggerMessageId, NULL, @detail, @createdAt)
`;

function elapsedHoursSince(isoString, now) {
  if (!isoString) return 0;
  return Math.max(0, (now - new Date(isoString).getTime()) / 3_600_000);
}

/** 上長（role='admin'）の一覧。担当者が admin 本人でも除外しない（monitoring.md §3）。 */
export function findManagerIds(db) {
  return db
    .prepare(`SELECT id FROM users WHERE role = ? ORDER BY id`)
    .all(ROLE.ADMIN)
    .map((row) => row.id);
}

/**
 * 通知の本文。**学生氏名は入るが、メッセージ本文は入れない**（CLAUDE.md §6-8）。
 * 氏名は通知先が担当人事・上長に限られ、画面表示にも必要なので許容する。
 */
export function buildDetail({ kind, studentName, elapsedHours }) {
  const name = studentName ?? '(不明な学生)';
  const hours = Math.floor(elapsedHours);
  // デモで閾値を秒単位に短縮すると 0 になる。「0 時間ありません」は日本語として壊れる
  const elapsed = hours >= 1 ? `${hours} 時間` : '1 時間未満';

  return kind === ALERT_KIND.SLA_ESCALATE
    ? `${name} さんへの返信が ${elapsed} ありません。担当者に代わって対応を検討してください。`
    : `${name} さんへの返信が ${elapsed} ありません。`;
}

/**
 * 1ルームぶんの通知先を決める。
 *
 * - 24h：担当者へ1件。**未アサインなら上長全員へ直行**（通知先がないと一番取りこぼす）
 * - 48h：上長全員へ。担当者が admin 本人でも除外しない
 *
 * @returns {{kind: string, targetUserId: number}[]}
 */
export function resolveTargets({ elapsedHours, assigneeId, managerIds }) {
  const targets = [];

  if (elapsedHours >= SLA_ESCALATE_HOURS) {
    for (const managerId of managerIds) {
      targets.push({ kind: ALERT_KIND.SLA_ESCALATE, targetUserId: managerId });
    }
  }

  if (elapsedHours >= SLA_NOTIFY_HOURS) {
    if (assigneeId) {
      targets.push({ kind: ALERT_KIND.SLA_NOTIFY, targetUserId: assigneeId });
    } else {
      for (const managerId of managerIds) {
        targets.push({ kind: ALERT_KIND.SLA_NOTIFY, targetUserId: managerId });
      }
    }
  }

  return targets;
}

/**
 * 閾値を超えたルームを検出し、alerts に積む。
 *
 * @returns {{id: number, kind: string, targetUserId: number, roomId: number}[]}
 *   **新規に作られたものだけ**。既に通知済みのものは含まない（配信対象）。
 */
export function detectSlaBreaches(db, now = Date.now()) {
  const rooms = db.prepare(TARGET_ROOMS_SQL).all(...SLA_ALERT_EXEMPT_STATUSES);
  if (rooms.length === 0) return [];

  const managerIds = findManagerIds(db);
  const insert = db.prepare(INSERT_SQL);
  const createdAt = new Date(now).toISOString();
  const created = [];

  const run = db.transaction(() => {
    for (const room of rooms) {
      if (!room.triggerMessageId) continue;

      const elapsedHours = elapsedHoursSince(room.lastStudentMessageAt, now);
      const targets = resolveTargets({ elapsedHours, assigneeId: room.assigneeId, managerIds });

      for (const target of targets) {
        const result = insert.run({
          kind: target.kind,
          severity: ALERT_SEVERITY.WARN,
          roomId: room.roomId,
          targetUserId: target.targetUserId,
          actorUserId: room.assigneeId,
          triggerMessageId: room.triggerMessageId,
          detail: buildDetail({
            kind: target.kind,
            studentName: room.studentName,
            elapsedHours,
          }),
          createdAt,
        });

        // 既に通知済みなら changes === 0。配信しない
        if (result.changes === 0) continue;

        created.push({
          id: Number(result.lastInsertRowid),
          kind: target.kind,
          targetUserId: target.targetUserId,
          roomId: room.roomId,
        });
      }
    }
  });

  run();
  return created;
}

/**
 * 人事が返信したので、そのルームの未解決 SLA 通知を閉じる。
 *
 * コンプライアンス警告（kind='compliance'）は**閉じない**。あちらは
 * 「起きた事実の記録」であって、解消するものではないため。
 *
 * ★閉じた行を返すのは配信のため（P4-1b）。宛先が分からないと
 *   `alert:resolved` を誰に送ればよいか決められず、片付いた通知が
 *   リロードするまで相手の画面に残る。
 *
 * @returns {{id: number, targetUserId: number, roomId: number}[]} 閉じた通知
 */
export function resolveSlaAlerts(db, roomId, now = Date.now()) {
  const placeholders = SLA_ALERT_KINDS.map(() => '?').join(', ');

  // UPDATE ... RETURNING は better-sqlite3 でも使えるが、SQLite 3.35 未満では動かない。
  // 先に対象を SELECT しておくほうが環境差に強い（同一トランザクション内なので競合しない）。
  const targets = db
    .prepare(
      `SELECT id, target_user_id AS targetUserId, room_id AS roomId
         FROM alerts
        WHERE room_id = ?
          AND kind IN (${placeholders})
          AND resolved_at IS NULL`,
    )
    .all(roomId, ...SLA_ALERT_KINDS);

  if (targets.length === 0) return [];

  db.prepare(
    `UPDATE alerts
        SET resolved_at = ?
      WHERE room_id = ?
        AND kind IN (${placeholders})
        AND resolved_at IS NULL`,
  ).run(new Date(now).toISOString(), roomId, ...SLA_ALERT_KINDS);

  return targets;
}
