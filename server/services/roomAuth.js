// A-4: ルーム認可の共通化。REST（routes/）とSocket（sockets/）の両方から呼ぶ単一の情報源。
// クライアントから送られたuserIdを信用せず、必ずroom_membersの実データで検証する。

export class RoomAccessDeniedError extends Error {
  constructor(message = 'not a member of this room') {
    super(message);
    this.name = 'RoomAccessDeniedError';
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
