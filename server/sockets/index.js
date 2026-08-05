// Socket.IO の登録口。
// 接続時のJWT認証（BE-1）と message:send 等のイベント処理本体（BE-2）は
// server/sockets/handlers/ 配下に分離して実装し、ここから呼び出す。
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
  });
}
