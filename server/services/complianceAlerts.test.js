import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  ALERT_KIND,
  ALERT_SEVERITY,
  COMPLIANCE_CATEGORY,
  ROLE,
} from '../../shared/constants.js';
import { clearComplianceRuleCache } from './complianceChecker.js';
import { ACK_NOTE, recordComplianceAlerts, resolveAckNote } from './complianceAlerts.js';

const RULES = [
  {
    code: 'honseki', category: COMPLIANCE_CATEGORY.DISCRIMINATION, keyword: '本籍',
    excludeKeyword: 'お伺いしません', severity: ALERT_SEVERITY.BLOCK,
    message: '本籍・出生地に関する質問は就職差別に当たるおそれがあります', priority: 1,
  },
  {
    code: 'withdraw_others', category: COMPLIANCE_CATEGORY.OWAHARA, keyword: '他社は辞退',
    excludeKeyword: null, severity: ALERT_SEVERITY.BLOCK,
    message: '他社選考の辞退を条件にすることはオワハラに当たります', priority: 20,
  },
];

/** alerts と辞書だけを持つ最小の DB。schema.sql の該当部分と同じ制約を張る。 */
function createDb() {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE compliance_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      category TEXT NOT NULL,
      keyword TEXT NOT NULL,
      exclude_keyword TEXT,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      priority INTEGER NOT NULL
    );
    CREATE TABLE alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL,
      room_id INTEGER NOT NULL,
      target_user_id INTEGER,
      actor_user_id INTEGER,
      trigger_message_id INTEGER,
      rule_code TEXT,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      resolved_at TEXT
    );
    CREATE UNIQUE INDEX idx_alerts_compliance_unique
      ON alerts(room_id, trigger_message_id, rule_code)
      WHERE kind = 'compliance';
  `);

  const insert = database.prepare(
    `INSERT INTO compliance_rules (code, category, keyword, exclude_keyword, severity, message, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const rule of RULES) {
    insert.run(rule.code, rule.category, rule.keyword, rule.excludeKeyword, rule.severity, rule.message, rule.priority);
  }

  clearComplianceRuleCache();
  return database;
}

function alertRows(db) {
  return db.prepare(`SELECT * FROM alerts ORDER BY id`).all();
}

const BASE = { roomId: 1, messageId: 10, actorUserId: 2, senderRole: ROLE.HR };

test('人事の発言を検知して alerts に記録する', () => {
  const db = createDb();

  recordComplianceAlerts(db, { ...BASE, body: 'ご本籍はどちらですか' });

  const rows = alertRows(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, ALERT_KIND.COMPLIANCE);
  assert.equal(rows[0].severity, ALERT_SEVERITY.BLOCK);
  assert.equal(rows[0].rule_code, 'honseki');
  assert.equal(rows[0].actor_user_id, 2);
  assert.equal(rows[0].target_user_id, null, '通知先は持たない（本人へはダイアログで伝える）');
  assert.equal(rows[0].resolved_at, null, 'コンプライアンス記録は解消しない');

  db.close();
  clearComplianceRuleCache();
});

test('学生の発言は検査しない', () => {
  const db = createDb();

  const results = recordComplianceAlerts(db, {
    ...BASE,
    senderRole: ROLE.STUDENT,
    body: 'ご本籍はどちらですか',
  });

  assert.deepEqual(results, []);
  assert.equal(alertRows(db).length, 0);

  db.close();
  clearComplianceRuleCache();
});

test('同じメッセージを2回記録しても増えない', () => {
  const db = createDb();

  recordComplianceAlerts(db, { ...BASE, body: 'ご本籍はどちらですか' });
  recordComplianceAlerts(db, { ...BASE, body: 'ご本籍はどちらですか' });

  assert.equal(alertRows(db).length, 1, '再送・リトライで二重に積まれない');

  db.close();
  clearComplianceRuleCache();
});

test('1通に複数ルールが当たればルールごとに記録する', () => {
  const db = createDb();

  recordComplianceAlerts(db, { ...BASE, body: 'ご本籍を教えてください。他社は辞退してください' });

  const rows = alertRows(db);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.rule_code).sort(), ['honseki', 'withdraw_others']);

  db.close();
  clearComplianceRuleCache();
});

test('detail に本文全体を保存しない', () => {
  const db = createDb();
  const secret = '山田太郎さんは第一志望ではないと聞いています';
  const body = `${secret}。ちなみにご本籍はどちらですか`;

  recordComplianceAlerts(db, { ...BASE, body });

  const { detail } = alertRows(db)[0];
  assert.ok(detail.includes('本籍'), '該当箇所は含む');
  assert.ok(!detail.includes(secret), '無関係な本文は含まない（CLAUDE.md §6-8）');

  db.close();
  clearComplianceRuleCache();
});

test('送信経路が detail に残る', () => {
  const db = createDb();

  // チェック未経由（socket 直叩きなど）
  recordComplianceAlerts(db, { ...BASE, body: 'ご本籍はどちらですか' });
  assert.ok(alertRows(db)[0].detail.endsWith(ACK_NOTE.UNCHECKED));

  // 警告を見たうえで送信した（P4-4 の「無視して送信」の集計元）
  recordComplianceAlerts(db, {
    ...BASE,
    messageId: 11,
    body: 'ご本籍はどちらですか',
    acknowledgedCodes: ['honseki'],
  });
  assert.ok(alertRows(db)[1].detail.endsWith(ACK_NOTE.ACKNOWLEDGED));

  // チェックは通ったが、この項目はクライアント側で拾えていなかった
  recordComplianceAlerts(db, {
    ...BASE,
    messageId: 12,
    body: 'ご本籍はどちらですか',
    acknowledgedCodes: [],
  });
  assert.ok(alertRows(db)[2].detail.endsWith(ACK_NOTE.MISMATCHED));

  db.close();
  clearComplianceRuleCache();
});

test('resolveAckNote は未指定を「チェック未経由」として扱う', () => {
  assert.equal(resolveAckNote('honseki', null), ACK_NOTE.UNCHECKED);
  assert.equal(resolveAckNote('honseki', undefined), ACK_NOTE.UNCHECKED);
  assert.equal(resolveAckNote('honseki', ['honseki']), ACK_NOTE.ACKNOWLEDGED);
  assert.equal(resolveAckNote('honseki', ['other']), ACK_NOTE.MISMATCHED);
});

test('該当が無ければ書き込まない', () => {
  const db = createDb();

  const results = recordComplianceAlerts(db, { ...BASE, body: '面接日程のご連絡です' });

  assert.deepEqual(results, []);
  assert.equal(alertRows(db).length, 0);

  db.close();
  clearComplianceRuleCache();
});
