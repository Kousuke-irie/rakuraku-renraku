// 仮実装：担当①の A-4（room_members 認可の共通化）が完了するまでのつなぎ。
// 同じ関数名・シグネチャで用意しておき、完了後は import 元を差し替えるだけにする。

export class RoomAccessDeniedError extends Error {
  constructor(message = 'not a member of this room') {
    super(message);
    this.name = 'RoomAccessDeniedError';
    this.statusCode = 403;
  }
}

// userId が roomId の room_members に含まれているか検証する。含まれなければ throw する。
export function assertRoomMember(db, userId, roomId) {
  const member = db
    .prepare('SELECT room_id FROM room_members WHERE room_id = ? AND user_id = ?')
    .get(roomId, userId);

  if (!member) {
    throw new RoomAccessDeniedError();
  }
}
