import {
  HANDLING_STATUS_META,
  MESSAGE_TYPE,
} from '../../shared/constants.js';
import { calculateRoomUrgency } from './urgencyCalculator.js';

const MESSAGE_COLUMNS = `
  id,
  room_id       AS roomId,
  sender_id     AS senderId,
  body,
  type,
  topic_tag     AS topicTag,
  client_msg_id AS clientMsgId,
  created_at    AS createdAt,
  deleted_at    AS deletedAt
`;

export function updateHandlingStatus(db, { roomId, userId, handlingStatus }) {
  const now = new Date().toISOString();

  const run = db.transaction(() => {
    const current = db
      .prepare(`SELECT handling_status AS handlingStatus FROM rooms WHERE id = ?`)
      .get(roomId);
    if (!current || current.handlingStatus === handlingStatus) {
      return { message: null, changed: false };
    }

    db.prepare(`UPDATE rooms SET handling_status = ? WHERE id = ?`).run(handlingStatus, roomId);

    const urgency = calculateRoomUrgency(db, roomId);
    db.prepare(`UPDATE rooms SET urgency = ? WHERE id = ?`).run(urgency, roomId);

    const actor = db.prepare(`SELECT display_name AS displayName FROM users WHERE id = ?`).get(userId);
    const statusLabel = HANDLING_STATUS_META[handlingStatus].label;
    const body = `${actor.displayName}が対応ステータスを「${statusLabel}」に変更しました`;
    const { lastInsertRowid: messageId } = db
      .prepare(
        `INSERT INTO messages (room_id, sender_id, body, type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(roomId, userId, body, MESSAGE_TYPE.SYSTEM, now);

    db.prepare(
      `UPDATE rooms SET last_message_id = ?, last_message_at = ? WHERE id = ?`,
    ).run(messageId, now, roomId);

    const message = db
      .prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`)
      .get(messageId);

    return { message, changed: true };
  });

  return run();
}
