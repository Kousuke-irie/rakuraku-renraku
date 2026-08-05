// Socket.IO の登録口。
// 接続時のJWT認証（担当①のA-4）が完了するまでは、handshake.auth.userIdを暫定的に信用する。
// A-4完了後はここをCookieのJWT検証に差し替える。
import db from '../db/db.js';
import { ROLE } from '../../shared/constants.js';
import { registerMessageHandlers } from './handlers/message.js';

function resolveTempUser(socket) {
  const userId = Number(socket.handshake.auth?.userId);
  if (!userId) return null;
  return db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) || null;
}

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    const user = resolveTempUser(socket);

    if (!user) {
      socket.emit('error', { code: 'unauthorized', message: 'invalid or missing userId' });
      socket.disconnect(true);
      return;
    }

    socket.data.user = { id: user.id, role: user.role };

    const roomIds = db.prepare('SELECT room_id FROM room_members WHERE user_id = ?').all(user.id);
    roomIds.forEach(({ room_id }) => socket.join(`room:${room_id}`));

    if (user.role === ROLE.HR) {
      socket.join('hr');
    }

    registerMessageHandlers(io, socket);

    socket.on('disconnect', () => {});
  });
}
