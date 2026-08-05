// routes/sockets が共通で使う DB 接続。migrate.js と同じ設定（WAL / foreign_keys ON）。
import Database from 'better-sqlite3';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/app.db';

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
