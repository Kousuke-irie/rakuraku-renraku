import { MESSAGE_TYPE, ROLE, SOCKET_ON } from '../../shared/constants.js';
import { countUnreadAlerts } from './alertView.js';
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

/**
 * 共有メモの追加・更新を人事全員へ配信する（P2-5）。
 * 呼び出し側で `scope === 'shared'` を確認すること。個人メモは配信しない。
 */
export function emitMemoUpdated(io, memo) {
  if (!io) return;
  io.to('hr').emit(SOCKET_ON.MEMO_UPDATED, { roomId: memo.roomId, memo });
}

/**
 * SLA通知は宛先本人にだけ配信する（P4-1）。
 * 担当者の通知が他の人事に見えると「誰が遅れているか」が漏れるため。
 */
export function emitAlertNew(io, targetUserId, alert) {
  if (!io || !targetUserId || !alert) return;
  io.to(`user:${targetUserId}`).emit(SOCKET_ON.ALERT_NEW, { alert });
}

/**
 * 通知が解消されたことを宛先本人へ配信する（P4-1b）。
 *
 * ★`unreadCount` を必ず添えること。通知一覧を一度も開いていない画面では
 *   クライアントが未読件数を再計算できず、ベルの数字だけが減らないまま残る。
 *
 * @param {{id: number, targetUserId: number}[]} resolved 閉じた通知
 */
export function emitAlertsResolved(io, db, resolved) {
  if (!io || !Array.isArray(resolved) || resolved.length === 0) return;

  const idsByUser = new Map();
  for (const alert of resolved) {
    if (!alert?.targetUserId) continue;
    const ids = idsByUser.get(alert.targetUserId) ?? [];
    ids.push(alert.id);
    idsByUser.set(alert.targetUserId, ids);
  }

  for (const [targetUserId, alertIds] of idsByUser) {
    io.to(`user:${targetUserId}`).emit(SOCKET_ON.ALERT_RESOLVED, {
      alertIds,
      unreadCount: countUnreadAlerts(db, targetUserId),
    });
  }
}

/** AI要約は生成を依頼した本人にだけ配信する。 */
export function emitAiSummaryUpdated(io, userId, summary) {
  if (!io) return;
  io.to(`user:${userId}`).emit(SOCKET_ON.AI_SUMMARY_UPDATED, summary);
}

export function emitReadUpdated(io, payload) {
  if (!io) return;
  io.to(`room:${payload.roomId}`).emit(SOCKET_ON.READ_UPDATED, payload);
}
