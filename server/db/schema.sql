-- .claude/database.md 準拠のスキーマ。
-- CHECK 制約の列挙値は shared/constants.js と完全に一致させること。

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status_message TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#7C9CBF',
  role TEXT NOT NULL CHECK(role IN ('hr', 'student', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  university TEXT,
  faculty TEXT,
  grad_year INTEGER,
  selection_status TEXT NOT NULL DEFAULT 'entry' CHECK(selection_status IN (
    'entry', 'document', 'aptitude',
    'interview_1', 'interview_2', 'interview_3', 'interview_4', 'interview_5',
    'offer', 'declined'
  )),
  next_interview_at TEXT,
  next_interview_room TEXT,
  interviewer TEXT,
  schedule_state TEXT NOT NULL DEFAULT 'none' CHECK(schedule_state IN (
    'none', 'proposed', 'interviewer_check', 'room_pending', 'confirmed'
  )),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'dm' CHECK(type IN ('dm', 'group')),
  name TEXT,
  student_user_id INTEGER REFERENCES users(id),
  handling_status TEXT NOT NULL DEFAULT 'needs_reply' CHECK(handling_status IN (
    'needs_reply', 'in_progress', 'waiting_student', 'done', 'on_hold'
  )),
  assignee_user_id INTEGER REFERENCES users(id),
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK(urgency IN ('high', 'normal', 'low')),
  last_message_id INTEGER REFERENCES messages(id),
  last_message_at TEXT,
  last_student_message_at TEXT,
  ai_priority TEXT CHECK(ai_priority IN ('high', 'normal', 'low') OR ai_priority IS NULL),
  ai_priority_reason TEXT,
  ai_requested_action TEXT,
  ai_context_summary TEXT,
  ai_analyzed_message_id INTEGER REFERENCES messages(id),
  ai_analyzed_at TEXT,
  ai_model TEXT,
  ai_analysis_status TEXT NOT NULL DEFAULT 'skipped' CHECK(ai_analysis_status IN (
    'pending', 'completed', 'failed', 'skipped'
  )),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  last_read_message_id INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'system')),
  topic_tag TEXT CHECK(topic_tag IN (
    'absence_late', 'scheduling', 'aptitude_test', 'result_waiting', 'question', 'other'
  )),
  client_msg_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS read_receipts (
  message_id INTEGER NOT NULL REFERENCES messages(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  read_at TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'private' CHECK(scope IN ('private', 'shared')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tag_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL CHECK(tag IN (
    'absence_late', 'scheduling', 'aptitude_test', 'result_waiting', 'question', 'other'
  )),
  keyword TEXT NOT NULL,
  priority INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_room       ON messages(room_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_sort          ON rooms(urgency, last_student_message_at);
CREATE INDEX IF NOT EXISTS idx_rooms_status        ON rooms(handling_status);
CREATE INDEX IF NOT EXISTS idx_rooms_assignee       ON rooms(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user   ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_room          ON memos(room_id, scope);
