import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { AI_SUMMARY_STATUS } from '../../shared/constants.js';
import {
  buildAiSummaryInput,
  clearAiSummaryCache,
  generateAiSummary,
} from './aiSummary.js';

function createDatabase() {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      display_name TEXT NOT NULL
    );
    CREATE TABLE students (
      user_id INTEGER PRIMARY KEY,
      selection_status TEXT NOT NULL
    );
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY,
      student_user_id INTEGER NOT NULL,
      handling_status TEXT NOT NULL,
      urgency TEXT NOT NULL,
      assignee_user_id INTEGER,
      last_student_message_at TEXT,
      last_message_id INTEGER
    );
    CREATE TABLE room_members (
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      room_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT,
      topic_tag TEXT,
      deleted_at TEXT
    );
  `);

  const longBody = `${'あ'.repeat(40)}この部分は送信されない`;
  database.prepare(`INSERT INTO users (id, display_name) VALUES (1, '人事'), (2, '山田 太郎')`).run();
  database.prepare(`INSERT INTO students (user_id, selection_status) VALUES (2, 'interview_2')`).run();
  database
    .prepare(
      `INSERT INTO rooms (
         id, student_user_id, handling_status, urgency, assignee_user_id,
         last_student_message_at, last_message_id
       ) VALUES (12, 2, 'needs_reply', 'high', 1, '2026-08-05T00:00:00.000Z', 20)`,
    )
    .run();
  database.prepare(`INSERT INTO room_members (room_id, user_id) VALUES (12, 1)`).run();
  database
    .prepare(
      `INSERT INTO messages (id, room_id, sender_id, body, topic_tag, deleted_at)
       VALUES (20, 12, 2, ?, 'absence_late', NULL)`,
    )
    .run(longBody);

  return database;
}

afterEach(() => clearAiSummaryCache());

test('Geminiへ渡すメッセージ抜粋を40文字に制限する', () => {
  const database = createDatabase();
  const input = buildAiSummaryInput(database, 1, Date.parse('2026-08-06T00:00:00.000Z'));

  assert.equal(input.rooms.length, 1);
  assert.equal(input.rooms[0].lastMessageExcerpt, 'あ'.repeat(40));
  assert.equal(input.rooms[0].handlingStatus, '要返信');
  assert.equal(input.rooms[0].topicTag, '欠席・遅刻');
  assert.equal(input.rooms[0].elapsedHours, 24);
  database.close();
});

test('構造化JSONを検証し、学生名をDBの値に固定して返す', async () => {
  const database = createDatabase();
  let requestUrl = '';
  let requestOptions;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                situation: '欠席連絡が1件あり、24時間経過しています。',
                todos: [{
                  roomId: 12,
                  studentName: 'モデルが作った別名',
                  action: '欠席連絡に返信する',
                  reason: '24時間経過・緊急',
                }],
              }),
            }],
          },
        }],
      }),
    };
  };

  const result = await generateAiSummary(database, {
    userId: 1,
    apiKey: 'test-api-key',
    model: 'test-model',
    fetchImpl,
    now: () => Date.parse('2026-08-06T00:00:00.000Z'),
  });

  assert.equal(result.status, AI_SUMMARY_STATUS.READY);
  assert.equal(result.todos[0].studentName, '山田 太郎');
  assert.equal(result.generatedAt, '2026-08-06T00:00:00.000Z');
  assert.equal(requestUrl.includes('test-api-key'), false);
  assert.equal(requestOptions.headers['x-goog-api-key'], 'test-api-key');
  assert.equal(requestOptions.body.includes('この部分は送信されない'), false);
  const requestBody = JSON.parse(requestOptions.body);
  assert.equal(requestBody.generationConfig.responseMimeType, 'application/json');
  assert.equal(requestBody.generationConfig.responseSchema.type, 'OBJECT');
  assert.equal('responseFormat' in requestBody.generationConfig, false);
  database.close();
});

test('一覧にないroomIdを返した場合はerrorにフォールバックする', async () => {
  const database = createDatabase();
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              situation: '要返信があります。',
              todos: [{
                roomId: 999,
                studentName: '存在しない学生',
                action: '返信する',
                reason: '緊急',
              }],
            }),
          }],
        },
      }],
    }),
  });

  const result = await generateAiSummary(database, {
    userId: 1,
    apiKey: 'test-api-key',
    fetchImpl,
  });

  assert.equal(result.status, AI_SUMMARY_STATUS.ERROR);
  assert.equal(result.todos.length, 0);
  database.close();
});

test('APIキー未設定でも例外にせずunavailableを返す', async () => {
  const database = createDatabase();
  let called = false;
  const result = await generateAiSummary(database, {
    userId: 1,
    apiKey: '',
    fetchImpl: async () => {
      called = true;
    },
  });

  assert.equal(result.status, AI_SUMMARY_STATUS.UNAVAILABLE);
  assert.equal(called, false);
  database.close();
});
