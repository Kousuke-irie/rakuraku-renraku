// Socket.IO の登録口（A-4）。
// 接続時にhttpOnly CookieのJWTを検証し、自分の所属する全ルームへ一括joinする。
// 機能別ハンドラ（message等）は server/sockets/handlers/ に分割し、ここから registerXxxHandlers(io, socket) を呼び出す。
import { verifyToken } from '../middleware/auth.js';
import { listMemberRoomIds } from '../services/roomAuth.js';
import db from '../db/index.js';
import { ROLE } from '../../shared/constants.js';

// Cookieヘッダから指定した名前の値だけを取り出す（依存追加を避けた最小実装）。
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const target = cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${name}=`));
  if (!target) return null;
  return decodeURIComponent(target.slice(name.length + 1));
}

function authenticateSocket(socket) {
  const token = readCookie(socket.handshake.headers.cookie, 'token');
  return verifyToken(token);
}

export function registerSocketHandlers(io) {
  // ハンドシェイク時に認証する。失敗時はクライアント側で connect_error として受け取れる。
  io.use((socket, next) => {
    const user = authenticateSocket(socket);
    if (!user) {
      return next(new Error('unauthorized'));
    }
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;

    listMemberRoomIds(db, user.id).forEach((roomId) => {
      socket.join(`room:${roomId}`);
    });

    if (user.role === ROLE.HR || user.role === ROLE.ADMIN) {
      socket.join('hr');
    }

    socket.on('disconnect', () => {});
  });
}
