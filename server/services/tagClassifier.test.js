import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { TOPIC_TAG } from '../../shared/constants.js';
import { classifyTopicTag, clearTagRuleCache } from './tagClassifier.js';

test('優先度順で最初に一致した用件タグを返す', () => {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE tag_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      keyword TEXT NOT NULL,
      priority INTEGER NOT NULL
    )
  `);
  database
    .prepare(`INSERT INTO tag_rules (tag, keyword, priority) VALUES (?, ?, ?)`)
    .run(TOPIC_TAG.SCHEDULING, '日程', 2);
  database
    .prepare(`INSERT INTO tag_rules (tag, keyword, priority) VALUES (?, ?, ?)`)
    .run(TOPIC_TAG.ABSENCE_LATE, '欠席', 1);

  clearTagRuleCache();
  assert.equal(
    classifyTopicTag(database, '面接日程の件ですが、欠席します'),
    TOPIC_TAG.ABSENCE_LATE,
  );

  database.close();
  clearTagRuleCache();
});

test('辞書に一致しない本文はその他になる', () => {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE tag_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      keyword TEXT NOT NULL,
      priority INTEGER NOT NULL
    )
  `);

  clearTagRuleCache();
  assert.equal(classifyTopicTag(database, 'よろしくお願いします'), TOPIC_TAG.OTHER);

  database.close();
  clearTagRuleCache();
});
