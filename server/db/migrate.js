import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ALERT_KIND_VALUES } from '../../shared/constants.js';

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

/**
 * compliance_rules.code の UNIQUE を落とす（P4-2）。
 *
 * P4-0 で `code TEXT NOT NULL UNIQUE` として作ってしまったが、1つのルールが複数の
 * キーワードを持つため code は行のグループキーでなければならない。SQLite はインラインの
 * UNIQUE 制約だけを落とせないので、テーブルごと作り直す。
 * 辞書は seed で入れ直す前提のため、データは移送しない。
 */
function dropLegacyComplianceRuleUnique(db) {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'compliance_rules'`)
    .get();
  if (!exists) return;

  const hasUnique = db
    .prepare(`PRAGMA index_list(compliance_rules)`)
    .all()
    .some((index) => index.unique === 1);
  if (!hasUnique) return;

  db.exec(`DROP TABLE compliance_rules`);
}

/**
 * alerts に後から足した列を埋める（P4-4 レビュー反映）。
 * schema.sql は CREATE TABLE IF NOT EXISTS なので、既存DBには列が増えない。
 */
function addMissingAlertColumns(db) {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'alerts'`)
    .get();
  if (!exists) return;

  const columns = new Set(db.prepare(`PRAGMA table_info(alerts)`).all().map((column) => column.name));
  if (columns.has('source')) return;

  // CHECK 付きの ALTER は SQLite が受け付けないので、制約なしで足す。
  // 値の妥当性は shared/constants.js の COMPLIANCE_SOURCE_VALUES 側で担保する。
  db.exec(`ALTER TABLE alerts ADD COLUMN source TEXT`);
}

const LEGACY_ALERTS_TABLE = 'alerts_legacy';

/**
 * alerts.kind の CHECK 制約を作り直す（P4-5 / P4-7）。
 *
 * `CREATE TABLE IF NOT EXISTS` では既存DBの CHECK が更新されないため、
 * 新しい kind を INSERT した瞬間に CONSTRAINT エラーで落ちる。
 * SQLite は CHECK だけを ALTER で差し替えられないのでテーブルごと作り直す。
 * **compliance_rules と違い、こちらは通知の履歴なのでデータを移送する。**
 *
 * ★判定は ALERT_KIND_VALUES の全件が CHECK 文に載っているかで行う。
 *   「最新の1件」を目印にすると、kind を足すたびにこのファイルの定数を
 *   更新し忘れて静かに壊れる。
 *
 * schema.sql の適用「前」に呼び、退避だけを行う。復元は restoreLegacyAlerts。
 * @returns {boolean} 退避したか
 */
function stashLegacyAlerts(db) {
  const table = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'alerts'`)
    .get();
  if (!table) return false;
  if (ALERT_KIND_VALUES.every((kind) => table.sql.includes(`'${kind}'`))) return false;

  // 旧インデックスは RENAME 後も同じ名前で退避先に残る。名前が衝突すると
  // schema.sql の CREATE INDEX IF NOT EXISTS が黙って飛ばされ、
  // **多重通知を防ぐ UNIQUE が新テーブルに張られない**。先に落としておく。
  const indexes = db
    .prepare(
      `SELECT name FROM sqlite_master
        WHERE type = 'index' AND tbl_name = 'alerts' AND sql IS NOT NULL`,
    )
    .all();
  for (const index of indexes) {
    db.exec(`DROP INDEX IF EXISTS "${index.name}"`);
  }

  db.exec(`DROP TABLE IF EXISTS ${LEGACY_ALERTS_TABLE}`);
  db.exec(`ALTER TABLE alerts RENAME TO ${LEGACY_ALERTS_TABLE}`);
  return true;
}

/** 退避した通知を新しい alerts へ移して退避先を捨てる。schema.sql の適用「後」に呼ぶ。 */
function restoreLegacyAlerts(db) {
  const legacy = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(LEGACY_ALERTS_TABLE);
  if (!legacy) return;

  // 列の増減があっても動くよう、両方に存在する列だけを移す
  const columnsOf = (table) =>
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => column.name);
  const target = new Set(columnsOf('alerts'));
  const shared = columnsOf(LEGACY_ALERTS_TABLE).filter((name) => target.has(name));
  const columnList = shared.map((name) => `"${name}"`).join(', ');

  db.exec(
    `INSERT INTO alerts (${columnList}) SELECT ${columnList} FROM ${LEGACY_ALERTS_TABLE}`,
  );
  db.exec(`DROP TABLE ${LEGACY_ALERTS_TABLE}`);
}

function migrate() {
  const dir = path.dirname(DATABASE_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DATABASE_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // schema.sql 内の idx_messages_schedule 作成より先に既存 messages を拡張する。
  addMissingMessageScheduleColumn(db);
  // schema.sql は CREATE TABLE IF NOT EXISTS なので、旧定義の取り壊しは適用前に行う。
  dropLegacyComplianceRuleUnique(db);
  const stashed = stashLegacyAlerts(db);

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  addMissingRoomAiColumns(db);
  addMissingAlertColumns(db);
  // 退避した通知を移すのは、schema.sql が新しい alerts を作り
  // addMissingAlertColumns が後付けの列を足し終えたあと。
  if (stashed) restoreLegacyAlerts(db);

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
