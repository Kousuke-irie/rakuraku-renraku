// B-2/B-3基盤: message:send の処理本体。
// 保存処理はREST(routes/messages.js)と共有し、ロジックの重複を避ける。
import db from '../../db/index.js';
import { assertRoomMember, RoomAccessDeniedError } from '../../services/roomAuth.js';
import { insertMessage } from '../../routes/messages.js';

export function registerMessageHandlers(io, socket) {
  socket.on('message:send', ({ roomId, body, clientMsgId }) => {
    const numericRoomId = Number(roomId);

    try {
      assertRoomMember(db, socket.data.user.id, numericRoomId);
    } catch (err) {
      if (err instanceof RoomAccessDeniedError) {
        socket.emit('error', { code: 'room_access_denied', message: err.message });
        return;
      }
      throw err;
    }

    if (typeof body !== 'string' || body.trim() === '' || typeof clientMsgId !== 'string' || clientMsgId === '') {
      socket.emit('error', { code: 'invalid_payload', message: 'body and clientMsgId are required' });
      return;
    }

    const existing = db
      .prepare(
        `SELECT id, sender_id AS senderId, body, type, topic_tag AS topicTag, created_at AS createdAt
         FROM messages WHERE client_msg_id = ?`,
      )
      .get(clientMsgId);

    const message =
      existing ||
      insertMessage({
        roomId: numericRoomId,
        senderId: socket.data.user.id,
        senderRole: socket.data.user.role,
        body,
        clientMsgId,
      });

    socket.emit('message:sent', { clientMsgId, message });
    io.to(`room:${numericRoomId}`).to('hr').emit('message:new', { message, room: { id: numericRoomId } });
  });
}
