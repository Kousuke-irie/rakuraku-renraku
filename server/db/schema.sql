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
  -- 検知の出どころ（'dictionary' / 'ai'）。SLA では NULL。
  -- ★rule_code に 'ai_' のような接頭辞を付けて代用しないこと。
  --   ダッシュボードの内訳で辞書とAIの粒度が混ざる（P4-2b の反省）
  source TEXT CHECK(source IN ('dictionary', 'ai') OR source IS NULL),
  -- 画面に出す短文。本文全体を入れないこと（CLAUDE.md §6-8）
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  -- SLA：人事が返信した時刻。コンプライアンスは常に NULL（記録を消さない）
  resolved_at TEXT
);

-- 就職差別・オワハラのキーワード辞書（P4-2）。tag_rules と同じ「1行＝1キーワード」。
-- code は UNIQUE にしないこと：1つのルール（例 honseki）が
-- 本籍/出身地/生まれはどこ の複数キーワードを持つため、code は行のグループキーになる。
CREATE TABLE IF NOT EXISTS compliance_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('discrimination', 'owahara')),
  keyword TEXT NOT NULL,
  -- これらのいずれかが本文に含まれていたら検知しない（誤検知対策。
  -- 例：「本籍地はお伺いしません」）。カンマ区切りで複数指定できる。
  -- 除外語自体にカンマを含めないこと。
  exclude_keyword TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('block', 'warn', 'info')),
  message TEXT NOT NULL,
  priority INTEGER NOT NULL
);

-- 選考フローの設定（P2-11）。人事が「どのステップを使うか」「学生にどう見せるか」を決める。
-- 選考ステータスの識別子そのものは shared/constants.js の SELECTION_STATUS が正で、
-- このテーブルは**見せ方の設定だけ**を持つ（受信箱・ボード・フィルタを壊さないため）。
-- CHECK の並びは SELECTION_FLOW_STEP_VALUES と完全に一致させること。
-- 'declined'（辞退）は終端の分岐でありフロー上の一段階ではないので含めない。
CREATE TABLE IF NOT EXISTS selection_steps (
  status_key TEXT PRIMARY KEY CHECK(status_key IN (
    'entry', 'document', 'aptitude',
    'interview_1', 'interview_2', 'interview_3', 'interview_4', 'interview_5',
    'offer'
  )),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1)),
  sort_order INTEGER NOT NULL,
  -- 学生画面での表示名の上書き。NULL なら SELECTION_STATUS_META のラベルを使う
  label TEXT,
  description TEXT,
  points TEXT,
  updated_at TEXT NOT NULL
);

-- 選考ステップごとの企業からのフィードバック（P2-11）。学生1名×ステップで1件。
-- ★学生には「完了済みステップ」のぶんしか返さないこと（server/services/selectionFlow.js）。
--   進行中の評価が合否連絡より先に本人へ漏れる。
CREATE TABLE IF NOT EXISTS selection_feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_user_id INTEGER NOT NULL REFERENCES users(id),
  status_key TEXT NOT NULL CHECK(status_key IN (
    'entry', 'document', 'aptitude',
    'interview_1', 'interview_2', 'interview_3', 'interview_4', 'interview_5',
    'offer'
  )),
  body TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(student_user_id, status_key)
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
CREATE INDEX IF NOT EXISTS idx_selection_steps_order ON selection_steps(is_enabled, sort_order);
CREATE INDEX IF NOT EXISTS idx_selection_feedbacks  ON selection_feedbacks(student_user_id);
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
