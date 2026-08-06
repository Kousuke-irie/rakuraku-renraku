// B-2/B-3基盤: message:send の処理本体。
// 保存処理はREST(routes/messages.js)と共有し、ロジックの重複を避ける。
import db from '../../db/index.js';
import { assertRoomMember, RoomAccessDeniedError } from '../../services/roomAuth.js';
import { insertMessage, findMessageByClientMsgId } from '../../routes/messages.js';
import { emitMessageNew, emitSummaryUpdated } from '../../services/realtime.js';
import { queueStudentMessageAnalysis } from '../../services/aiPriority.js';
import { ROLE, SOCKET_EMIT, SOCKET_ON } from '../../../shared/constants.js';

export function registerMessageHandlers(io, socket) {
  socket.on(SOCKET_EMIT.MESSAGE_SEND, async ({ roomId, body, clientMsgId } = {}) => {
    const numericRoomId = Number(roomId);

    try {
      assertRoomMember(db, socket.data.user.id, numericRoomId);
    } catch (err) {
      if (err instanceof RoomAccessDeniedError) {
        socket.emit(SOCKET_ON.ERROR, { code: err.code, message: err.message });
        return;
      }
      socket.emit(SOCKET_ON.ERROR, {
        code: 'internal_error',
        message: 'メッセージの送信に失敗しました',
      });
      return;
    }

    if (typeof body !== 'string' || body.trim() === '' || typeof clientMsgId !== 'string' || clientMsgId === '') {
      socket.emit(SOCKET_ON.ERROR, { code: 'invalid_payload', message: '本文と clientMsgId が必要です' });
      return;
    }

    try {
      const existing = findMessageByClientMsgId(clientMsgId);
      const message =
        existing ||
        insertMessage({
          roomId: numericRoomId,
          senderId: socket.data.user.id,
          senderRole: socket.data.user.role,
          body,
          clientMsgId,
        });

      socket.emit(SOCKET_ON.MESSAGE_SENT, { clientMsgId, message });
      if (!existing) {
        await emitMessageNew(io, db, message);
        emitSummaryUpdated(io, db);
        if (socket.data.user.role === ROLE.STUDENT) queueStudentMessageAnalysis(db, io, message);
      }
    } catch {
      socket.emit(SOCKET_ON.ERROR, {
        code: 'internal_error',
        message: 'メッセージの送信に失敗しました',
      });
    }
  });
}
