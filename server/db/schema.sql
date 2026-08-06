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
  schedule_request_id INTEGER REFERENCES schedule_requests(id),
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

-- 会社情報（P2-10）。人事が設定し、学生のトーク画面の会社情報パネルに出る。
-- 単一テナントなので必ず1行だけ。CHECK(id = 1) で2行目を作れないようにする。
CREATE TABLE IF NOT EXISTS company_info (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  name TEXT NOT NULL,
  description TEXT,
  recruit_site_url TEXT,
  updated_at TEXT NOT NULL
);

-- 擬似カレンダー上の面接官。チャット利用者ではないため users とは分離する。
CREATE TABLE IF NOT EXISTS calendar_interviewers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 擬似カレンダー上の既存予定。空き枠生成時に重なっている枠を受付終了として返す。
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interviewer_id INTEGER NOT NULL REFERENCES calendar_interviewers(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK(starts_at < ends_at)
);

-- 学生へ送る日程予約依頼。予約フローの状態の正はこの status とする。
CREATE TABLE IF NOT EXISTS schedule_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  student_user_id INTEGER NOT NULL REFERENCES users(id),
  interviewer_id INTEGER NOT NULL REFERENCES calendar_interviewers(id),
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  selection_stage TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
  available_from TEXT NOT NULL,
  available_until TEXT NOT NULL,
  daily_start_time TEXT,
  daily_end_time TEXT,
  response_deadline TEXT NOT NULL,
  interview_format TEXT NOT NULL CHECK(interview_format IN ('online', 'onsite')),
  location_text TEXT,
  needs_attention INTEGER NOT NULL DEFAULT 0 CHECK(needs_attention IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
    'draft', 'waiting_student', 'booked', 'expired', 'cancelled'
  )),
  booked_slot_id TEXT,
  booked_starts_at TEXT,
  booked_ends_at TEXT,
  booked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(available_from < available_until)
);

-- 予約成功の監査・競合防止。同じ外部枠IDは UNIQUE により必ず1件だけ成功する。
CREATE TABLE IF NOT EXISTS calendar_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_request_id INTEGER NOT NULL UNIQUE REFERENCES schedule_requests(id),
  interviewer_id INTEGER NOT NULL REFERENCES calendar_interviewers(id),
  external_slot_id TEXT NOT NULL UNIQUE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK(status = 'booked'),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_room       ON messages(room_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_sort          ON rooms(urgency, last_student_message_at);
CREATE INDEX IF NOT EXISTS idx_rooms_status        ON rooms(handling_status);
CREATE INDEX IF NOT EXISTS idx_rooms_assignee       ON rooms(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user   ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_room          ON memos(room_id, scope);
CREATE INDEX IF NOT EXISTS idx_messages_schedule   ON messages(schedule_request_id);
CREATE INDEX IF NOT EXISTS idx_schedule_room       ON schedule_requests(room_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_student    ON schedule_requests(student_user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events     ON calendar_events(interviewer_id, starts_at, ends_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_one_waiting_per_room
  ON schedule_requests(room_id) WHERE status = 'waiting_student';
