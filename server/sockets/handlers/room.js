import db from '../../db/index.js';
import { assertRoomMember, RoomAccessDeniedError } from '../../services/roomAuth.js';
import { updateHandlingStatus } from '../../services/roomStatus.js';
import { emitMessageNew, emitRoomUpdated, emitSummaryUpdated } from '../../services/realtime.js';
import {
  HANDLING_STATUS_VALUES,
  ROLE,
  SOCKET_EMIT,
  SOCKET_ON,
} from '../../../shared/constants.js';

function socketError(socket, code, message) {
  socket.emit(SOCKET_ON.ERROR, { code, message });
}

export function registerRoomHandlers(io, socket) {
  socket.on(SOCKET_EMIT.ROOM_STATUS_UPDATE, async ({ roomId, handlingStatus } = {}) => {
    const numericRoomId = Number(roomId);

    if (socket.data.user.role !== ROLE.HR && socket.data.user.role !== ROLE.ADMIN) {
      socketError(socket, 'forbidden', '人事担当者のみ変更できます');
      return;
    }
    if (!HANDLING_STATUS_VALUES.includes(handlingStatus)) {
      socketError(socket, 'invalid_payload', '対応ステータスが不正です');
      return;
    }

    try {
      assertRoomMember(db, socket.data.user.id, numericRoomId);
      const result = updateHandlingStatus(db, {
        roomId: numericRoomId,
        userId: socket.data.user.id,
        handlingStatus,
      });

      if (result.changed) {
        if (result.message) await emitMessageNew(io, db, result.message);
        await emitRoomUpdated(io, db, numericRoomId);
        emitSummaryUpdated(io, db);
      }
    } catch (error) {
      if (error instanceof RoomAccessDeniedError) {
        socketError(socket, error.code, error.message);
        return;
      }
      socketError(socket, 'internal_error', 'ステータスの更新に失敗しました');
    }
  });
}
