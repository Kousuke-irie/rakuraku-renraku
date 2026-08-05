import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/app.db';
const SCHEMA_PATH = path.resolve(import.meta.dirname, 'schema.sql');

function migrate() {
  const dir = path.dirname(DATABASE_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DATABASE_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

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
