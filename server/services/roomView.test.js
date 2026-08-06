import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { listRoomsForUser } from './roomView.js';
import { SORT_KEY } from '../../shared/constants.js';

function createDatabase() {
  const db = new Database(':memory:');
  const schema = fs.readFileSync(path.resolve(import.meta.dirname, '../db/schema.sql'), 'utf8');
  db.exec(schema);
  const now = '2026-08-06T00:00:00.000Z';
  db.exec(`
    INSERT INTO users (id, login_id, password_hash, display_name, role, created_at, updated_at) VALUES
      (1, 'hr', 'hash', '人事', 'hr', '${now}', '${now}'),
      (2, 'student-a', 'hash', '学生A', 'student', '${now}', '${now}'),
      (3, 'student-b', 'hash', '学生B', 'student', '${now}', '${now}'),
      (4, 'student-c', 'hash', '学生C', 'student', '${now}', '${now}');
    INSERT INTO students (user_id, selection_status, schedule_state, updated_at) VALUES
      (2, 'entry', 'none', '${now}'),
      (3, 'entry', 'none', '${now}'),
      (4, 'entry', 'none', '${now}');
    INSERT INTO rooms (
      id, student_user_id, handling_status, urgency, ai_priority, ai_priority_reason,
      ai_requested_action, ai_analyzed_message_id, ai_analyzed_at, ai_model,
      ai_analysis_status, created_at, last_student_message_at
    ) VALUES
      (10, 2, 'needs_reply', 'normal', NULL, NULL, NULL, NULL, NULL, NULL, 'skipped', '${now}', '${now}'),
      (11, 3, 'needs_reply', 'normal', NULL, NULL, NULL, NULL, NULL, NULL, 'skipped', '${now}', '${now}'),
      (12, 4, 'needs_reply', 'high', NULL, NULL, NULL, NULL, NULL, NULL, 'skipped', '${now}', '${now}');
    INSERT INTO room_members (room_id, user_id, joined_at) VALUES
      (10, 1, '${now}'), (11, 1, '${now}'), (12, 1, '${now}'), (11, 3, '${now}');
    INSERT INTO messages (id, room_id, sender_id, body, type, topic_tag, created_at)
      VALUES (101, 11, 3, '結果を知りたいです', 'text', 'result_waiting', '${now}');
    UPDATE rooms
      SET ai_priority = 'high',
          ai_priority_reason = '期限が迫っているため',
          ai_requested_action = '結果を知りたい',
          ai_analyzed_message_id = 101,
          ai_analyzed_at = '${now}',
          ai_model = 'test-model',
          ai_analysis_status = 'completed'
      WHERE id = 11;
  `);
  return db;
}

test('一覧はAI推奨度を優先し、未判定時はルール判定へフォールバックする', () => {
  const db = createDatabase();
  const rooms = listRoomsForUser(db, {
    userId: 1,
    handlingStatuses: null,
    selectionStatuses: null,
    topicTags: null,
    priorities: null,
    assigneeMode: null,
    assigneeId: null,
    queryPattern: null,
    sort: SORT_KEY.DEFAULT,
  });

  assert.deepEqual(rooms.map((room) => room.id), [11, 12, 10]);
  assert.equal(rooms[0].priority, 'high');
  assert.equal(rooms[1].priority, 'high');
  assert.deepEqual(rooms[0].aiRecommendation, {
    status: 'completed',
    priority: 'high',
    reason: '期限が迫っているため',
    requestedAction: '結果を知りたい',
    contextSummary: null,
    analyzedMessageId: 101,
    analyzedAt: '2026-08-06T00:00:00.000Z',
  });
  assert.equal(rooms[1].aiRecommendation.status, 'skipped');
  assert.equal(rooms[1].aiRecommendation.priority, null);
  db.close();
});

test('学生にはAIの内部判断を返さない', () => {
  const db = createDatabase();
  const [room] = listRoomsForUser(db, {
    userId: 3,
    handlingStatuses: null,
    selectionStatuses: null,
    topicTags: null,
    priorities: null,
    assigneeMode: null,
    assigneeId: null,
    queryPattern: null,
    sort: SORT_KEY.DEFAULT,
  });

  assert.deepEqual(room.aiRecommendation, {
    status: 'skipped',
    priority: null,
    reason: null,
    requestedAction: null,
    contextSummary: null,
    analyzedMessageId: null,
    analyzedAt: null,
  });
  db.close();
});
