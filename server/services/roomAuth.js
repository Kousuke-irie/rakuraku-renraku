// A-4: ルーム認可の共通化。REST（routes/）とSocket（sockets/）の両方から呼ぶ単一の情報源。
// クライアントから送られたuserIdを信用せず、必ずroom_membersの実データで検証する。

export class RoomAccessDeniedError extends Error {
  constructor(message = 'このルームにアクセスする権限がありません') {
    super(message);
    this.name = 'RoomAccessDeniedError';
    // クライアントは `{ error: code, message: 説明 }` を前提に message を表示する（api.md §1）。
    // error には表示用の文章ではなく機械可読なコードを入れること。
    this.code = 'room_access_denied';
    this.statusCode = 403;
  }
}

// userIdがroomIdのroom_membersに含まれているか検証する。含まれなければthrowする。
export function assertRoomMember(db, userId, roomId) {
  const member = db
    .prepare('SELECT room_id FROM room_members WHERE room_id = ? AND user_id = ?')
    .get(roomId, userId);

  if (!member) {
    throw new RoomAccessDeniedError();
  }
}

// userIdが所属する全ルームIDを返す。Socket接続時の一括joinに使う。
export function listMemberRoomIds(db, userId) {
  return db
    .prepare('SELECT room_id AS roomId FROM room_members WHERE user_id = ?')
    .all(userId)
    .map((row) => row.roomId);
}
