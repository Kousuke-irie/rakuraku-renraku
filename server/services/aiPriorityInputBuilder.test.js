import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  buildAiPriorityContext,
  buildRecentMessages,
  isAcknowledgementOnly,
} from './aiPriorityInputBuilder.js';

function createDatabase() {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT, role TEXT NOT NULL);
    CREATE TABLE students (user_id INTEGER PRIMARY KEY, next_interview_at TEXT);
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY,
      student_user_id INTEGER NOT NULL,
      handling_status TEXT NOT NULL,
      ai_analyzed_message_id INTEGER,
      ai_analysis_status TEXT NOT NULL DEFAULT 'skipped'
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      room_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      topic_tag TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);
  database.exec(`
    INSERT INTO users VALUES (1, '人事担当者名', 'hr'), (2, '学生氏名', 'student');
    INSERT INTO students VALUES (2, '2026-08-07T00:00:00.000Z');
    INSERT INTO rooms VALUES (10, 2, 'needs_reply', NULL, 'skipped');
  `);
  return database;
}

test('最小入力には最新学生メッセージと直前人事メッセージだけを含める', () => {
  const db = createDatabase();
  db.exec(`
    INSERT INTO messages VALUES
      (1, 10, 1, '面接は明日です', 'text', NULL, '2026-08-05T00:00:00.000Z', NULL),
      (2, 10, 2, '他社の回答期限が明日なので結果を教えてください', 'text', 'result_waiting', '2026-08-06T00:00:00.000Z', NULL);
  `);

  const context = buildAiPriorityContext(db, {
    roomId: 10,
    messageId: 2,
    now: Date.parse('2026-08-06T04:00:00.000Z'),
  });

  assert.deepEqual(context.minimalInput, {
    latestStudentMessage: '他社の回答期限が明日なので結果を教えてください',
    previousHrMessage: '面接は明日です',
    topicTag: 'result_waiting',
    elapsedHours: 4,
    nextEvent: { type: 'interview', hoursUntil: 20 },
  });
  assert.equal(JSON.stringify(context.minimalInput).includes('学生氏名'), false);
  assert.equal(JSON.stringify(context.minimalInput).includes('人事担当者名'), false);
  db.close();
});

test('追加文脈は通常メッセージだけを最大6件、古い順で返す', () => {
  const db = createDatabase();
  const insert = db.prepare(`INSERT INTO messages VALUES (?, 10, ?, ?, ?, ?, ?, ?)`);
  for (let id = 1; id <= 8; id += 1) {
    insert.run(
      id,
      id % 2 === 0 ? 2 : 1,
      `本文${id}`,
      id === 2 ? 'system' : 'text',
      id % 2 === 0 ? 'other' : null,
      `2026-08-06T0${id}:00:00.000Z`,
      id === 3 ? '2026-08-06T09:00:00.000Z' : null,
    );
  }

  const messages = buildRecentMessages(db, { roomId: 10, messageId: 8 });
  assert.equal(messages.length, 6);
  assert.deepEqual(messages.map((message) => message.body), ['本文1', '本文4', '本文5', '本文6', '本文7', '本文8']);
  assert.deepEqual(messages.map((message) => message.sender), ['hr', 'student', 'hr', 'student', 'hr', 'student']);
  db.close();
});

test('短い了承だけをスキップし、追加要望があれば分析する', () => {
  assert.equal(isAcknowledgementOnly('承知しました'), true);
  assert.equal(isAcknowledgementOnly('ありがとうございます。結果はいつ分かりますか？'), false);
});
