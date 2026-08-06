// Socket.IO の登録口（A-4）。
// 接続時にhttpOnly CookieのJWTを検証し、自分の所属する全ルームへ一括joinする。
// 機能別ハンドラ（message等）は server/sockets/handlers/ に分割し、ここから registerXxxHandlers(io, socket) を呼び出す。
import { verifyToken } from '../middleware/auth.js';
import { listMemberRoomIds } from '../services/roomAuth.js';
import db from '../db/index.js';
import { ROLE } from '../../shared/constants.js';
import { registerMessageHandlers } from './handlers/message.js';
import { registerRoomHandlers } from './handlers/room.js';
import { registerReadHandlers } from './handlers/read.js';
import { registerScheduleHandlers } from './handlers/schedule.js';

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
      // クライアントは connect_error でこのコードを見てログイン画面へ退避する
      // （再接続を無限に繰り返さないため）。err.data がそのまま渡る。
      const error = new Error('unauthorized');
      error.data = { code: 'unauthorized', message: 'ログインが必要です' };
      return next(error);
    }
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;

    // ユーザー本人だけに返す通知（AI要約など）の宛先。
    socket.join(`user:${user.id}`);

    listMemberRoomIds(db, user.id).forEach((roomId) => {
      socket.join(`room:${roomId}`);
    });

    if (user.role === ROLE.HR || user.role === ROLE.ADMIN) {
      socket.join('hr');
    }

    registerMessageHandlers(io, socket);
    registerRoomHandlers(io, socket);
    registerReadHandlers(io, socket);
    registerScheduleHandlers(io, socket);

    socket.on('disconnect', () => {});
  });
}
