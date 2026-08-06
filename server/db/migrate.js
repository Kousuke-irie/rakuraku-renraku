import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/app.db';
const SCHEMA_PATH = path.resolve(import.meta.dirname, 'schema.sql');

const ROOM_AI_COLUMNS = Object.freeze([
  ['ai_priority', `TEXT CHECK(ai_priority IN ('high', 'normal', 'low') OR ai_priority IS NULL)`],
  ['ai_priority_reason', 'TEXT'],
  ['ai_requested_action', 'TEXT'],
  ['ai_context_summary', 'TEXT'],
  ['ai_analyzed_message_id', 'INTEGER REFERENCES messages(id)'],
  ['ai_analyzed_at', 'TEXT'],
  ['ai_model', 'TEXT'],
  [
    'ai_analysis_status',
    `TEXT NOT NULL DEFAULT 'skipped' CHECK(ai_analysis_status IN ('pending', 'completed', 'failed', 'skipped'))`,
  ],
]);

function addMissingRoomAiColumns(db) {
  const columns = new Set(db.prepare(`PRAGMA table_info(rooms)`).all().map((column) => column.name));

  for (const [name, definition] of ROOM_AI_COLUMNS) {
    if (columns.has(name)) continue;
    db.exec(`ALTER TABLE rooms ADD COLUMN ${name} ${definition}`);
  }
}

function addMissingMessageScheduleColumn(db) {
  const table = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get('messages');
  if (!table) return;

  const columns = new Set(db.prepare(`PRAGMA table_info(messages)`).all().map((column) => column.name));
  if (!columns.has('schedule_request_id')) {
    db.exec(`ALTER TABLE messages ADD COLUMN schedule_request_id INTEGER REFERENCES schedule_requests(id)`);
  }
}

function migrate() {
  const dir = path.dirname(DATABASE_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DATABASE_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // schema.sql 内の idx_messages_schedule 作成より先に既存 messages を拡張する。
  addMissingMessageScheduleColumn(db);
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  addMissingRoomAiColumns(db);

  db.close();
}

try {
  migrate();
  console.log(`migrate: applied schema to ${DATABASE_PATH}`);
  process.exit(0);
} catch (err) {
  console.error('migrate: failed', err);
  process.exit(1);
}
