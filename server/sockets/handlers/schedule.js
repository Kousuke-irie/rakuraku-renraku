import { ROLE, SOCKET_EMIT, SOCKET_ON } from '../../../shared/constants.js';
import db from '../../db/index.js';
import { assertRoomMember, RoomAccessDeniedError } from '../../services/roomAuth.js';
import { findScheduleRequestRecord } from '../../services/scheduleRequests.js';

function canWatch(record, user) {
  if (!record) return false;
  if (user.role === ROLE.STUDENT) return Number(record.studentUserId) === Number(user.id);
  if (user.role === ROLE.HR || user.role === ROLE.ADMIN) {
    assertRoomMember(db, user.id, record.roomId);
    return true;
  }
  return false;
}

export function registerScheduleHandlers(io, socket) {
  socket.on(SOCKET_EMIT.SCHEDULE_WATCH, ({ requestId } = {}, ack) => {
    try {
      const record = findScheduleRequestRecord(db, Number(requestId));
      if (!canWatch(record, socket.data.user)) {
        if (typeof ack === 'function') ack({ ok: false, code: 'not_found' });
        return;
      }
      socket.join(`calendar:${record.interviewerId}`);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (error) {
      const code = error instanceof RoomAccessDeniedError ? error.code : 'internal_error';
      if (typeof ack === 'function') ack({ ok: false, code });
      else socket.emit(SOCKET_ON.ERROR, { code, message: '空き枠の更新購読に失敗しました' });
    }
  });

  socket.on(SOCKET_EMIT.SCHEDULE_UNWATCH, ({ requestId } = {}) => {
    const record = findScheduleRequestRecord(db, Number(requestId));
    if (record) socket.leave(`calendar:${record.interviewerId}`);
  });
}
