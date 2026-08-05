// B-2/B-3基盤: メッセージ履歴取得・送信(RESTフォールバック)。
// 送信取消(DELETE /messages/:id)は対象外。
import { Router } from 'express';
import db from '../db/db.js';
import { tempAuth } from '../middleware/tempAuth.js';
import { assertRoomMember, RoomAccessDeniedError } from '../services/roomAuth.js';
import { MESSAGE_TYPE } from '../../shared/constants.js';

const router = Router();

const DEFAULT_LIMIT = 50;

function requireRoomMember(req, res, roomId) {
  try {
    assertRoomMember(db, req.user.id, roomId);
    return true;
  } catch (err) {
    if (err instanceof RoomAccessDeniedError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return false;
    }
    throw err;
  }
}

router.get('/rooms/:id/messages', tempAuth, (req, res) => {
  const roomId = Number(req.params.id);
  if (!requireRoomMember(req, res, roomId)) return;

  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, DEFAULT_LIMIT);
  const before = req.query.before ? Number(req.query.before) : null;

  const rows = before
    ? db
        .prepare(
          `SELECT id, sender_id AS senderId, body, type, topic_tag AS topicTag, created_at AS createdAt
           FROM messages
           WHERE room_id = ? AND id < ? AND deleted_at IS NULL
           ORDER BY id DESC LIMIT ?`,
        )
        .all(roomId, before, limit)
    : db
        .prepare(
          `SELECT id, sender_id AS senderId, body, type, topic_tag AS topicTag, created_at AS createdAt
           FROM messages
           WHERE room_id = ? AND deleted_at IS NULL
           ORDER BY id DESC LIMIT ?`,
        )
        .all(roomId, limit);

  res.json({ messages: rows });
});

router.post('/rooms/:id/messages', tempAuth, (req, res) => {
  const roomId = Number(req.params.id);
  if (!requireRoomMember(req, res, roomId)) return;

  const { body, clientMsgId } = req.body;

  if (typeof body !== 'string' || body.trim() === '') {
    return res.status(400).json({ success: false, error: 'body is required' });
  }
  if (typeof clientMsgId !== 'string' || clientMsgId === '') {
    return res.status(400).json({ success: false, error: 'clientMsgId is required' });
  }

  const existing = db
    .prepare(
      `SELECT id, sender_id AS senderId, body, type, topic_tag AS topicTag, created_at AS createdAt
       FROM messages WHERE client_msg_id = ?`,
    )
    .get(clientMsgId);

  if (existing) {
    return res.status(200).json({ message: existing });
  }

  const message = insertMessage({ roomId, senderId: req.user.id, senderRole: req.user.role, body, clientMsgId });

  res.status(201).json({ message });
});

// message.js(Socket)と共有する保存処理。1トランザクションでmessages+roomsを更新する。
export function insertMessage({ roomId, senderId, senderRole, body, clientMsgId }) {
  const now = new Date().toISOString();

  const run = db.transaction(() => {
    const { lastInsertRowid: messageId } = db
      .prepare(
        `INSERT INTO messages (room_id, sender_id, body, type, client_msg_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(roomId, senderId, body, MESSAGE_TYPE.TEXT, clientMsgId, now);

    // TODO(P1-5): ここでタグ判定(tagClassifier)を呼び、messages.topic_tagを更新する
    // TODO(P1-6): ここでurgencyCalculatorを呼び、rooms.urgencyを再計算する
    // TODO(P2-3): ここでstatusTransitionを呼び、rooms.handling_statusを自動遷移する

    if (senderRole === 'student') {
      db.prepare(
        `UPDATE rooms SET last_message_id = ?, last_message_at = ?, last_student_message_at = ? WHERE id = ?`,
      ).run(messageId, now, now, roomId);
    } else {
      db.prepare(`UPDATE rooms SET last_message_id = ?, last_message_at = ? WHERE id = ?`).run(
        messageId,
        now,
        roomId,
      );
    }

    return db
      .prepare(
        `SELECT id, sender_id AS senderId, body, type, topic_tag AS topicTag, created_at AS createdAt
         FROM messages WHERE id = ?`,
      )
      .get(messageId);
  });

  return run();
}

export default router;
