// B-2/B-3基盤: メッセージ履歴取得・送信(RESTフォールバック)。
// 送信取消(DELETE /messages/:id)は対象外。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { assertRoomMember } from '../services/roomAuth.js';
import { classifyTopicTag } from '../services/tagClassifier.js';
import { calculateRoomUrgency } from '../services/urgencyCalculator.js';
import { emitMessageNew, emitSummaryUpdated } from '../services/realtime.js';
import { applyStatusTransition } from '../services/statusTransition.js';
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

  // 対応ステータスの変更履歴（type='system'・P1-2）は人事の社内情報なので学生には返さない。
  // リアルタイム配信側の除外は services/realtime.js が担う。
  const params = {
    roomId,
    limit,
    includeSystem: req.user.role === ROLE.STUDENT ? 0 : 1,
    systemType: MESSAGE_TYPE.SYSTEM,
  };

  const rows = before
    ? db
        .prepare(
          `SELECT ${MESSAGE_COLUMNS}
           FROM messages
           WHERE room_id = @roomId AND id < @before AND deleted_at IS NULL
             AND (@includeSystem = 1 OR type != @systemType)
           ORDER BY id DESC LIMIT @limit`,
        )
        .all({ ...params, before })
    : db
        .prepare(
          `SELECT ${MESSAGE_COLUMNS}
           FROM messages
           WHERE room_id = @roomId AND deleted_at IS NULL
             AND (@includeSystem = 1 OR type != @systemType)
           ORDER BY id DESC LIMIT @limit`,
        )
        .all(params);

  res.json({ messages: rows });
});

router.post('/rooms/:id/messages', requireAuth, async (req, res, next) => {
  try {
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

    const io = req.app.get('io');
    await emitMessageNew(io, db, message);
    emitSummaryUpdated(io, db);

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

// message.js(Socket)と共有する保存処理。1トランザクションでmessages+roomsを更新する。
export function insertMessage({ roomId, senderId, senderRole, body, clientMsgId }) {
  const now = new Date().toISOString();

  const run = db.transaction(() => {
    const topicTag = senderRole === ROLE.STUDENT ? classifyTopicTag(db, body) : null;
    const { lastInsertRowid: messageId } = db
      .prepare(
        `INSERT INTO messages (room_id, sender_id, body, type, topic_tag, client_msg_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(roomId, senderId, body, MESSAGE_TYPE.TEXT, topicTag, clientMsgId, now);

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

    applyStatusTransition(db, roomId, senderRole);
    const urgency = calculateRoomUrgency(db, roomId);
    db.prepare(`UPDATE rooms SET urgency = ? WHERE id = ?`).run(urgency, roomId);

    return db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`).get(messageId);
  });

  return run();
}

export default router;
