import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { analyzeStudentMessage } from './aiPriority.js';

function createDatabase(body = '結果はいつ分かりますか？', topicTag = 'result_waiting') {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, role TEXT NOT NULL);
    CREATE TABLE students (user_id INTEGER PRIMARY KEY, next_interview_at TEXT);
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY,
      student_user_id INTEGER NOT NULL,
      handling_status TEXT NOT NULL,
      ai_priority TEXT,
      ai_priority_reason TEXT,
      ai_requested_action TEXT,
      ai_context_summary TEXT,
      ai_analyzed_message_id INTEGER,
      ai_analyzed_at TEXT,
      ai_model TEXT,
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
    INSERT INTO users VALUES (1, 'hr'), (2, 'student');
    INSERT INTO students VALUES (2, NULL);
    INSERT INTO rooms (id, student_user_id, handling_status) VALUES (10, 2, 'needs_reply');
  `);
  db.prepare(`INSERT INTO messages VALUES (1, 10, 2, ?, 'text', ?, '2026-08-06T00:00:00.000Z', NULL)`).run(body, topicTag);
  return db;
}

test('APIキー未設定時はGeminiを呼ばずskippedにする', async () => {
  const db = createDatabase();
  let called = false;
  await analyzeStudentMessage(db, null, { roomId: 10, messageId: 1 }, {
    apiKey: '',
    classifier: async () => {
      called = true;
    },
  });

  const room = db.prepare(`SELECT * FROM rooms WHERE id = 10`).get();
  assert.equal(called, false);
  assert.equal(room.ai_analysis_status, 'skipped');
  assert.equal(room.ai_analyzed_message_id, 1);
  db.close();
});

test('検証済み結果を最新学生メッセージに紐付けて保存する', async () => {
  const db = createDatabase();
  await analyzeStudentMessage(db, null, { roomId: 10, messageId: 1 }, {
    apiKey: 'test-key',
    model: 'test-model',
    classifier: async () => ({
      priority: 'high',
      reason: '他社の回答期限が明日までのため',
      requestedAction: '合否結果の連絡時期を知りたい',
      contextSummary: '他社の回答期限が明日まで',
      needsMoreContext: false,
    }),
  });

  const room = db.prepare(`SELECT * FROM rooms WHERE id = 10`).get();
  assert.equal(room.ai_analysis_status, 'completed');
  assert.equal(room.ai_priority, 'high');
  assert.equal(room.ai_model, 'test-model');
  db.close();
});

test('新しい学生メッセージの状態を古い分析結果で上書きしない', async () => {
  const db = createDatabase();
  let resolveClassifier;
  const classifier = () => new Promise((resolve) => {
    resolveClassifier = resolve;
  });
  const analysis = analyzeStudentMessage(db, null, { roomId: 10, messageId: 1 }, {
    apiKey: 'test-key',
    classifier,
  });

  await new Promise((resolve) => globalThis.setImmediate(resolve));
  db.prepare(`INSERT INTO messages VALUES (2, 10, 2, '新しい質問です', 'text', 'question', '2026-08-06T01:00:00.000Z', NULL)`).run();
  db.prepare(`UPDATE rooms SET ai_analyzed_message_id = 2, ai_analysis_status = 'pending' WHERE id = 10`).run();
  resolveClassifier({
    priority: 'high',
    reason: '古い理由',
    requestedAction: '古い要望',
    contextSummary: null,
    needsMoreContext: false,
  });
  await analysis;

  const room = db.prepare(`SELECT * FROM rooms WHERE id = 10`).get();
  assert.equal(room.ai_analyzed_message_id, 2);
  assert.equal(room.ai_analysis_status, 'pending');
  assert.equal(room.ai_priority, null);
  db.close();
});
