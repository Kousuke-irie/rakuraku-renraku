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

-- 監視イベント（P4-0）。SLA 通知もコンプライアンス警告もここに集約する。
-- 多重登録は下の部分UNIQUEインデックス2本で防ぐ。INSERT OR IGNORE と必ずセットで使うこと。
-- テーブルレベルの UNIQUE は使えない：SQLite は UNIQUE 中の NULL を互いに異なる値として
-- 扱うため、target_user_id が NULL のコンプライアンス行が重複し放題になる。
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('sla_notify', 'sla_escalate', 'compliance')),
  severity TEXT NOT NULL CHECK(severity IN ('block', 'warn', 'info')),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  -- 通知先。SLA は担当者／上長、コンプライアンスは NULL（本人へは即時ダイアログで伝える）
  target_user_id INTEGER REFERENCES users(id),
  -- 原因を作った人。コンプライアンスは送信者、SLA は担当者
  actor_user_id INTEGER REFERENCES users(id),
  -- 起点メッセージ。冪等キーの一部
  trigger_message_id INTEGER REFERENCES messages(id),
  -- compliance_rules.code。SLA では NULL
  rule_code TEXT,
  -- 画面に出す短文。本文全体を入れないこと（CLAUDE.md §6-8）
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  -- SLA：人事が返信した時刻。コンプライアンスは常に NULL（記録を消さない）
  resolved_at TEXT
);

-- 就職差別・オワハラのキーワード辞書（P4-2）。tag_rules と同じ形。
CREATE TABLE IF NOT EXISTS compliance_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK(category IN ('discrimination', 'owahara')),
  keyword TEXT NOT NULL,
  -- これが本文に含まれていたら検知しない（誤検知対策。例：「本籍地はお伺いしません」）
  exclude_keyword TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('block', 'warn', 'info')),
  message TEXT NOT NULL,
  priority INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_room       ON messages(room_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_sort          ON rooms(urgency, last_student_message_at);
CREATE INDEX IF NOT EXISTS idx_rooms_status        ON rooms(handling_status);
CREATE INDEX IF NOT EXISTS idx_rooms_assignee       ON rooms(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user   ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_room          ON memos(room_id, scope);
-- ★多重通知を防ぐ唯一の仕組み。60秒タイマーはこれに依存している。
-- SLA：1ルーム×1起点メッセージ×1宛先×1種別につき1件だけ。
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_sla_unique
  ON alerts(kind, room_id, trigger_message_id, target_user_id)
  WHERE kind IN ('sla_notify', 'sla_escalate');
-- コンプライアンス：1メッセージ×1ルールにつき1件だけ（target_user_id は NULL なので使えない）。
-- 1通に複数ルールが当たれば rule_code の数だけ行が立つ。これは意図した挙動。
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_compliance_unique
  ON alerts(room_id, trigger_message_id, rule_code)
  WHERE kind = 'compliance';

-- 通知一覧（自分宛・未読優先・新しい順）
CREATE INDEX IF NOT EXISTS idx_alerts_target       ON alerts(target_user_id, read_at, created_at DESC);
-- 未解決のSLA件数・エスカレーション一覧（P4-4 のKPI）
CREATE INDEX IF NOT EXISTS idx_alerts_open         ON alerts(kind, resolved_at);
-- 返信時の解消 UPDATE
CREATE INDEX IF NOT EXISTS idx_alerts_room         ON alerts(room_id);
CREATE INDEX IF NOT EXISTS idx_compliance_rules    ON compliance_rules(priority, id);
