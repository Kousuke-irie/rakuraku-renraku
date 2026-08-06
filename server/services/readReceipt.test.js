import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { markRoomRead } from './readReceipt.js';

function createDatabase() {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE room_members (
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      last_read_message_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (room_id, user_id)
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      room_id INTEGER NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE read_receipts (
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id)
    );
    INSERT INTO room_members (room_id, user_id) VALUES (1, 10);
    INSERT INTO messages (id, room_id) VALUES (1, 1), (2, 1), (3, 2);
  `);
  return database;
}

test('既読位置を保存し、古いイベントで巻き戻さない', () => {
  const database = createDatabase();

  assert.equal(markRoomRead(database, { roomId: 1, userId: 10, lastReadMessageId: 2 }), 2);
  assert.equal(markRoomRead(database, { roomId: 1, userId: 10, lastReadMessageId: 1 }), 2);

  database.close();
});

test('別ルームまたは存在しないメッセージは拒否する', () => {
  const database = createDatabase();

  assert.equal(markRoomRead(database, { roomId: 1, userId: 10, lastReadMessageId: 3 }), null);
  assert.equal(markRoomRead(database, { roomId: 1, userId: 10, lastReadMessageId: 99 }), null);

  database.close();
});
