// B-2/B-3基盤: message:send の処理本体。
// 保存処理はREST(routes/messages.js)と共有し、ロジックの重複を避ける。
import db from '../../db/index.js';
import { assertRoomMember, RoomAccessDeniedError } from '../../services/roomAuth.js';
import { insertMessage, findMessageByClientMsgId } from '../../routes/messages.js';
import { SOCKET_EMIT, SOCKET_ON } from '../../../shared/constants.js';

export function registerMessageHandlers(io, socket) {
  socket.on(SOCKET_EMIT.MESSAGE_SEND, ({ roomId, body, clientMsgId }) => {
    const numericRoomId = Number(roomId);

    try {
      assertRoomMember(db, socket.data.user.id, numericRoomId);
    } catch (err) {
      if (err instanceof RoomAccessDeniedError) {
        socket.emit(SOCKET_ON.ERROR, { code: err.code, message: err.message });
        return;
      }
      throw err;
    }

    if (typeof body !== 'string' || body.trim() === '' || typeof clientMsgId !== 'string' || clientMsgId === '') {
      socket.emit(SOCKET_ON.ERROR, { code: 'invalid_payload', message: '本文と clientMsgId が必要です' });
      return;
    }

    const message =
      findMessageByClientMsgId(clientMsgId) ||
      insertMessage({
        roomId: numericRoomId,
        senderId: socket.data.user.id,
        senderRole: socket.data.user.role,
        body,
        clientMsgId,
      });

    socket.emit(SOCKET_ON.MESSAGE_SENT, { clientMsgId, message });
    io.to(`room:${numericRoomId}`)
      .to('hr')
      .emit(SOCKET_ON.MESSAGE_NEW, { message, room: { id: numericRoomId } });
  });
}
