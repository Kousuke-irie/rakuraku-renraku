// P4-5: 面接会議室の未設定通知。
//
// 面接日程は決まっているのに `students.next_interview_room` が空欄、という状態を検出する。
// 当日になって「部屋が押さえられていない」が起きるうえ、`{会議室}` を含む定型文（P2-2）が
// 埋まらないので学生への案内も打てない。人事が気づく前に受信箱へ載せる。
//
// ★多重通知を防ぐのは alerts の部分UNIQUEインデックス（idx_alerts_interview_room_unique）だけ。
//   60秒タイマーから何度呼ばれても INSERT OR IGNORE で弾かれる。
//   **アプリ側に「通知済みかどうか」の状態を持たせないこと。**
//
// 判定は `schedule_state = 'room_pending'`（P3-4 の進捗）では行わない。
// あれは人事が手で進める値なので、手が回っていないときに立っていない。
// 監視は**実データ（日時と会議室名）**を見るのが正しい（monitoring.md §3b）。
import {
  ALERT_KIND,
  ALERT_SEVERITY,
  INTERVIEW_ROOM_ALERT_LEAD_HOURS as DEFAULT_LEAD_HOURS,
  SELECTION_STATUS,
} from '../../shared/constants.js';
import { findManagerIds } from './slaMonitor.js';

function envHours(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const INTERVIEW_ROOM_ALERT_LEAD_HOURS = envHours(
  'INTERVIEW_ROOM_ALERT_LEAD_HOURS',
  DEFAULT_LEAD_HOURS,
);

/**
 * 会議室が空欄のまま面接日時が入っているルーム。
 * 辞退した学生は面接自体が無いので外す。対応ステータスは条件にしない
 * （返信済み・保留でも、会議室が無いという事実は変わらない）。
 */
const TARGET_ROOMS_SQL = `
  SELECT
    r.id                 AS roomId,
    r.assignee_user_id   AS assigneeId,
    su.display_name      AS studentName,
    st.next_interview_at AS nextInterviewAt
  FROM rooms r
  JOIN students st ON st.user_id = r.student_user_id
  LEFT JOIN users su ON su.id = r.student_user_id
  WHERE st.next_interview_at IS NOT NULL
    AND (st.next_interview_room IS NULL OR TRIM(st.next_interview_room) = '')
    AND st.selection_status != ?
`;

const INSERT_SQL = `
  INSERT OR IGNORE INTO alerts
    (kind, severity, room_id, target_user_id, actor_user_id, trigger_message_id, rule_code, detail, created_at)
  VALUES
    (@kind, @severity, @roomId, @targetUserId, @actorUserId, NULL, @ruleCode, @detail, @createdAt)
`;

/**
 * 解消すべき通知（＝もう現実と合っていないもの）。
 *
 * `rule_code` に入れた面接日時と現在の値を突き合わせるので、
 * 日程が変わった通知は自動的に閉じ、新しい日時で1件立つ。
 * 面接が過ぎたものも閉じる。**いま会議室を押さえても手遅れで、
 * 押しても何も起きない通知を一覧に残さない**ため。
 */
const STALE_ALERTS_SQL = `
  SELECT a.id, a.target_user_id AS targetUserId, a.room_id AS roomId
    FROM alerts a
    JOIN rooms r ON r.id = a.room_id
    LEFT JOIN students st ON st.user_id = r.student_user_id
   WHERE a.kind = @kind
     AND a.resolved_at IS NULL
     AND (
          st.next_interview_at IS NULL
       OR st.next_interview_at <> a.rule_code
       OR st.next_interview_at <= @now
       OR (st.next_interview_room IS NOT NULL AND TRIM(st.next_interview_room) <> '')
       OR st.selection_status = @declined
     )
     AND (@roomId IS NULL OR a.room_id = @roomId)
`;

function hoursUntil(isoString, now) {
  return (new Date(isoString).getTime() - now) / 3_600_000;
}

/**
 * 通知先を決める。担当者へ1件、**未アサインなら上長全員へ直行**（P4-1 と同じ考え方）。
 *
 * 上長へのエスカレーションは段階を設けない。会議室の押さえ漏れは
 * 「担当者が気づけば5秒で終わる作業」であり、上長を巻き込む筋の話ではない。
 *
 * @returns {number[]} 宛先ユーザーID。NULL は返さない（冪等キーに使うため）
 */
export function resolveInterviewRoomTargets({ assigneeId, managerIds }) {
  if (assigneeId) return [assigneeId];
  return [...managerIds];
}

/**
 * 通知の本文。学生氏名は入るが、面接日時そのものは入れない。
 * サーバでローカル時刻に整形すると環境のタイムゾーンに引きずられる（CLAUDE.md §6-2）。
 * 正確な日時はプロフィールパネルで見られるので、ここは残り時間だけを伝える。
 */
export function buildInterviewRoomDetail({ studentName, remainingHours }) {
  const name = studentName ?? '(不明な学生)';
  const hours = Math.floor(remainingHours);
  // 閾値をデモ用に短縮すると 0 になる。「残り 0 時間」は日本語として壊れる
  const remaining = hours >= 1 ? `残り ${hours} 時間` : '残り1時間未満';

  return `${name} さんの面接まで${remaining}ですが、会議室が未設定です。会場を入力してください。`;
}

/**
 * 会議室が未設定の面接を検出し、alerts に積む。
 *
 * @returns {{id: number, kind: string, targetUserId: number, roomId: number}[]}
 *   **新規に作られたものだけ**（配信対象）。既に通知済みのものは含まない。
 */
export function detectInterviewRoomGaps(db, now = Date.now()) {
  const rooms = db.prepare(TARGET_ROOMS_SQL).all(SELECTION_STATUS.DECLINED);
  if (rooms.length === 0) return [];

  const managerIds = findManagerIds(db);
  const insert = db.prepare(INSERT_SQL);
  const createdAt = new Date(now).toISOString();
  const created = [];

  const run = db.transaction(() => {
    for (const room of rooms) {
      const remainingHours = hoursUntil(room.nextInterviewAt, now);

      // 過ぎた面接は対象外。まだ先すぎる面接も鳴らさない
      // （「押さえていないだけ」を通知にすると狼少年になる）
      if (remainingHours <= 0 || remainingHours > INTERVIEW_ROOM_ALERT_LEAD_HOURS) continue;

      const detail = buildInterviewRoomDetail({
        studentName: room.studentName,
        remainingHours,
      });

      for (const targetUserId of resolveInterviewRoomTargets({
        assigneeId: room.assigneeId,
        managerIds,
      })) {
        const result = insert.run({
          kind: ALERT_KIND.INTERVIEW_ROOM_MISSING,
          severity: ALERT_SEVERITY.WARN,
          roomId: room.roomId,
          targetUserId,
          actorUserId: room.assigneeId,
          // ★冪等キー。面接日時が変われば別の通知になる
          ruleCode: room.nextInterviewAt,
          detail,
          createdAt,
        });

        // 既に通知済みなら changes === 0。配信しない
        if (result.changes === 0) continue;

        created.push({
          id: Number(result.lastInsertRowid),
          kind: ALERT_KIND.INTERVIEW_ROOM_MISSING,
          targetUserId,
          roomId: room.roomId,
        });
      }
    }
  });

  run();
  return created;
}

/**
 * 現実と合わなくなった会議室未設定通知を閉じる。
 *
 * 会議室が入力された／日程が変わった／日程が消えた／面接が過ぎた／辞退した、のいずれか。
 * `roomId` を渡すとそのルームだけを対象にする（プロフィール更新の直後に呼ぶ用）。
 * 渡さなければ全ルームを掃除する（60秒タイマー用）。
 *
 * @returns {{id: number, targetUserId: number, roomId: number}[]} 閉じた通知（配信対象）
 */
export function resolveStaleInterviewRoomAlerts(db, { roomId = null, now = Date.now() } = {}) {
  const params = {
    kind: ALERT_KIND.INTERVIEW_ROOM_MISSING,
    now: new Date(now).toISOString(),
    declined: SELECTION_STATUS.DECLINED,
    roomId,
  };

  const stale = db.prepare(STALE_ALERTS_SQL).all(params);
  if (stale.length === 0) return [];

  const update = db.prepare(`UPDATE alerts SET resolved_at = ? WHERE id = ?`);
  const run = db.transaction(() => {
    for (const alert of stale) update.run(params.now, alert.id);
  });

  run();
  return stale;
}
