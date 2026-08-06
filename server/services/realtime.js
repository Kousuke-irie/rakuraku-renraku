import { MESSAGE_TYPE, ROLE, SOCKET_ON } from '../../shared/constants.js';
import { findRoomForUser } from './roomView.js';
import { getSummary } from './summary.js';

async function uniqueSockets(io, groups) {
  const sockets = await Promise.all(groups.map((group) => io.in(group).fetchSockets()));
  return [...new Map(sockets.flat().map((socket) => [socket.id, socket])).values()];
}

/**
 * システムメッセージ（対応ステータスの変更履歴・P1-2）は人事の社内情報なので、
 * 学生には配信しない。履歴取得側の除外は routes/messages.js が担う。
 */
export function isMessageVisibleTo(message, role) {
  return message.type !== MESSAGE_TYPE.SYSTEM || role !== ROLE.STUDENT;
}

export async function emitMessageNew(io, db, message) {
  if (!io) return;

  const roomId = Number(message.roomId);
  const sockets = await uniqueSockets(io, [`room:${roomId}`, 'hr']);

  for (const socket of sockets) {
    if (!isMessageVisibleTo(message, socket.data.user.role)) continue;

    const room = findRoomForUser(db, socket.data.user.id, roomId);
    if (room) socket.emit(SOCKET_ON.MESSAGE_NEW, { message, room });
  }
}

export async function emitRoomUpdated(io, db, roomId) {
  if (!io) return;

  const sockets = await io.in('hr').fetchSockets();
  for (const socket of sockets) {
    const room = findRoomForUser(db, socket.data.user.id, roomId);
    if (room) socket.emit(SOCKET_ON.ROOM_UPDATED, { room });
  }
}

export function emitSummaryUpdated(io, db) {
  if (!io) return;
  io.to('hr').emit(SOCKET_ON.SUMMARY_UPDATED, getSummary(db));
}

export function emitReadUpdated(io, payload) {
  if (!io) return;
  io.to(`room:${payload.roomId}`).emit(SOCKET_ON.READ_UPDATED, payload);
}
