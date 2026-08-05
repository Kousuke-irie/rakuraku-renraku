// B-2/B-3基盤: メッセージ履歴取得・送信(RESTフォールバック)。
// 送信取消(DELETE /messages/:id)は対象外。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { assertRoomMember } from '../services/roomAuth.js';
import { MESSAGE_TYPE, ROLE } from '../../shared/constants.js';

const router = Router();

const DEFAULT_LIMIT = 50;

// クライアント（messages ストア）は roomId でキャッシュし clientMsgId で
// 楽観描画を突き合わせる。SELECT する列は api.md の message の形と一致させること。
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

export function findMessageByClientMsgId(clientMsgId) {
  return db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE client_msg_id = ?`).get(clientMsgId);
}

router.get('/rooms/:id/messages', requireAuth, (req, res) => {
  const roomId = Number(req.params.id);
  // RoomAccessDeniedError は errorHandler が 403 `{ error, message }` に変換する。
  assertRoomMember(db, req.user.id, roomId);

  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, DEFAULT_LIMIT);
  const before = req.query.before ? Number(req.query.before) : null;

  const rows = before
    ? db
        .prepare(
          `SELECT ${MESSAGE_COLUMNS}
           FROM messages
           WHERE room_id = ? AND id < ? AND deleted_at IS NULL
           ORDER BY id DESC LIMIT ?`,
        )
        .all(roomId, before, limit)
    : db
        .prepare(
          `SELECT ${MESSAGE_COLUMNS}
           FROM messages
           WHERE room_id = ? AND deleted_at IS NULL
           ORDER BY id DESC LIMIT ?`,
        )
        .all(roomId, limit);

  res.json({ messages: rows });
});

router.post('/rooms/:id/messages', requireAuth, (req, res) => {
  const roomId = Number(req.params.id);
  assertRoomMember(db, req.user.id, roomId);

  const { body, clientMsgId } = req.body;

  if (typeof body !== 'string' || body.trim() === '') {
    return res.status(400).json({ error: 'invalid_request', message: '本文が空です' });
  }
  if (typeof clientMsgId !== 'string' || clientMsgId === '') {
    return res.status(400).json({ error: 'invalid_request', message: 'clientMsgId が必要です' });
  }

  const existing = findMessageByClientMsgId(clientMsgId);

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

    if (senderRole === ROLE.STUDENT) {
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

    return db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`).get(messageId);
  });

  return run();
}

export default router;
