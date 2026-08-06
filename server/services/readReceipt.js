export function markRoomRead(db, { roomId, userId, lastReadMessageId }) {
  const message = db
    .prepare(`SELECT id FROM messages WHERE id = ? AND room_id = ? AND deleted_at IS NULL`)
    .get(lastReadMessageId, roomId);
  if (!message) return null;

  const now = new Date().toISOString();
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE room_members
       SET last_read_message_id = CASE
         WHEN last_read_message_id < ? THEN ?
         ELSE last_read_message_id
       END
       WHERE room_id = ? AND user_id = ?`,
    ).run(lastReadMessageId, lastReadMessageId, roomId, userId);

    db.prepare(
      `INSERT INTO read_receipts (message_id, user_id, read_at)
       VALUES (?, ?, ?)
       ON CONFLICT(message_id, user_id) DO UPDATE SET read_at = excluded.read_at`,
    ).run(lastReadMessageId, userId, now);

    return db
      .prepare(
        `SELECT last_read_message_id AS lastReadMessageId
         FROM room_members
         WHERE room_id = ? AND user_id = ?`,
      )
      .get(roomId, userId)?.lastReadMessageId;
  });

  return run();
}
