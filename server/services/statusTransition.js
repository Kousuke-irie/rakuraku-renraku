import { HANDLING_STATUS, ROLE } from '../../shared/constants.js';

export function nextHandlingStatus(currentStatus, senderRole) {
  if (currentStatus === HANDLING_STATUS.ON_HOLD) return currentStatus;

  if (senderRole === ROLE.STUDENT) {
    return [HANDLING_STATUS.WAITING_STUDENT, HANDLING_STATUS.DONE].includes(currentStatus)
      ? HANDLING_STATUS.NEEDS_REPLY
      : currentStatus;
  }

  if (senderRole === ROLE.HR || senderRole === ROLE.ADMIN) {
    return [HANDLING_STATUS.NEEDS_REPLY, HANDLING_STATUS.IN_PROGRESS].includes(currentStatus)
      ? HANDLING_STATUS.WAITING_STUDENT
      : currentStatus;
  }

  return currentStatus;
}

export function applyStatusTransition(db, roomId, senderRole) {
  const room = db
    .prepare(`SELECT handling_status AS handlingStatus FROM rooms WHERE id = ?`)
    .get(roomId);
  if (!room) return null;

  const handlingStatus = nextHandlingStatus(room.handlingStatus, senderRole);
  if (handlingStatus !== room.handlingStatus) {
    db.prepare(`UPDATE rooms SET handling_status = ? WHERE id = ?`).run(handlingStatus, roomId);
  }

  return handlingStatus;
}
