import db from '../../db/index.js';
import { assertRoomMember, RoomAccessDeniedError } from '../../services/roomAuth.js';
import { markRoomRead } from '../../services/readReceipt.js';
import { emitReadUpdated, emitRoomUpdated } from '../../services/realtime.js';
import { SOCKET_EMIT, SOCKET_ON } from '../../../shared/constants.js';

export function registerReadHandlers(io, socket) {
  socket.on(SOCKET_EMIT.MESSAGE_READ, async ({ roomId, lastReadMessageId } = {}) => {
    const numericRoomId = Number(roomId);
    const numericMessageId = Number(lastReadMessageId);

    if (!Number.isInteger(numericMessageId) || numericMessageId <= 0) {
      socket.emit(SOCKET_ON.ERROR, { code: 'invalid_payload', message: '既読位置が不正です' });
      return;
    }

    try {
      assertRoomMember(db, socket.data.user.id, numericRoomId);
      const persistedId = markRoomRead(db, {
        roomId: numericRoomId,
        userId: socket.data.user.id,
        lastReadMessageId: numericMessageId,
      });
      if (persistedId === null) {
        socket.emit(SOCKET_ON.ERROR, {
          code: 'invalid_payload',
          message: '指定されたメッセージはこのルームに存在しません',
        });
        return;
      }

      emitReadUpdated(io, {
        roomId: numericRoomId,
        userId: socket.data.user.id,
        lastReadMessageId: persistedId,
      });
      await emitRoomUpdated(io, db, numericRoomId);
    } catch (error) {
      if (error instanceof RoomAccessDeniedError) {
        socket.emit(SOCKET_ON.ERROR, { code: error.code, message: error.message });
        return;
      }
      socket.emit(SOCKET_ON.ERROR, {
        code: 'internal_error',
        message: '既読状態の更新に失敗しました',
      });
    }
  });
}
