import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  ALERT_SEVERITY,
  COMPLIANCE_CATEGORY,
  ROLE,
} from '../../shared/constants.js';
import {
  checkCompliance,
  clearComplianceRuleCache,
  extractMatchContext,
  hasBlocking,
  isCheckedRole,
  isExcluded,
} from './complianceChecker.js';

const SCHEMA = `
  CREATE TABLE compliance_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    category TEXT NOT NULL,
    keyword TEXT NOT NULL,
    exclude_keyword TEXT,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    priority INTEGER NOT NULL
  )
`;

/** テスト用の辞書を持つ in-memory DB を作る。 */
function createDb(rules) {
  const database = new Database(':memory:');
  database.exec(SCHEMA);

  const insert = database.prepare(
    `INSERT INTO compliance_rules (code, category, keyword, exclude_keyword, severity, message, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const rule of rules) {
    insert.run(
      rule.code,
      rule.category,
      rule.keyword,
      rule.excludeKeyword ?? null,
      rule.severity,
      rule.message,
      rule.priority,
    );
  }

  clearComplianceRuleCache();
  return database;
}

const HONSEKI = {
  code: 'honseki',
  category: COMPLIANCE_CATEGORY.DISCRIMINATION,
  keyword: '本籍',
  excludeKeyword: 'お伺いしません,伺いません',
  severity: ALERT_SEVERITY.BLOCK,
  message: '本籍・出生地に関する質問は就職差別に当たるおそれがあります',
  priority: 1,
};

const HONSEKI_ALT = { ...HONSEKI, keyword: '出身地' };

const WITHDRAW = {
  code: 'withdraw_others',
  category: COMPLIANCE_CATEGORY.OWAHARA,
  keyword: '他社は辞退',
  excludeKeyword: null,
  severity: ALERT_SEVERITY.BLOCK,
  message: '他社選考の辞退を条件にすることはオワハラに当たります',
  priority: 20,
};

const PRESSURE = {
  code: 'pressure_soft',
  category: COMPLIANCE_CATEGORY.OWAHARA,
  keyword: '早めに返事を',
  excludeKeyword: null,
  severity: ALERT_SEVERITY.WARN,
  message: '判断を急がせる表現になっていないか確認してください',
  priority: 24,
};

test('就職差別に当たる質問を検知する', () => {
  const db = createDb([HONSEKI]);

  const results = checkCompliance(db, 'ご本籍はどちらですか');
  assert.equal(results.length, 1);
  assert.equal(results[0].code, 'honseki');
  assert.equal(results[0].category, COMPLIANCE_CATEGORY.DISCRIMINATION);
  assert.equal(results[0].severity, ALERT_SEVERITY.BLOCK);

  db.close();
  clearComplianceRuleCache();
});

test('オワハラ表現を検知する', () => {
  const db = createDb([WITHDRAW]);

  const results = checkCompliance(db, '内定をお出しするので他社は辞退してください');
  assert.equal(results.length, 1);
  assert.equal(results[0].code, 'withdraw_others');

  db.close();
  clearComplianceRuleCache();
});

test('除外語を含む正しい文は検知しない', () => {
  const db = createDb([HONSEKI]);

  // ★誤検知対策の要。この文が block になるとこの機能は信用を失う
  assert.deepEqual(checkCompliance(db, '本籍地はお伺いしませんのでご安心ください'), []);
  assert.deepEqual(checkCompliance(db, '本籍については伺いません'), []);

  db.close();
  clearComplianceRuleCache();
});

test('同じルールの別キーワードでも1件に畳む', () => {
  const db = createDb([HONSEKI, HONSEKI_ALT]);

  const results = checkCompliance(db, 'ご本籍と出身地を教えてください');
  assert.equal(results.length, 1, '本籍と出身地は同じ code なので1件');
  assert.equal(results[0].code, 'honseki');

  db.close();
  clearComplianceRuleCache();
});

test('1通に複数の問題があれば全件を重い順に返す', () => {
  // 用件タグ（最初のマッチで確定）と違い、こちらは全件返すのが仕様
  const db = createDb([PRESSURE, HONSEKI, WITHDRAW]);

  const results = checkCompliance(db, 'ご本籍を教えてください。他社は辞退のうえ早めに返事をください');
  assert.equal(results.length, 3);
  assert.deepEqual(
    results.map((result) => result.severity),
    [ALERT_SEVERITY.BLOCK, ALERT_SEVERITY.BLOCK, ALERT_SEVERITY.WARN],
    'block が warn より先に並ぶ',
  );

  db.close();
  clearComplianceRuleCache();
});

test('該当が無ければ空配列を返す', () => {
  const db = createDb([HONSEKI, WITHDRAW]);

  assert.deepEqual(checkCompliance(db, '面接日程のご連絡です。よろしくお願いいたします。'), []);
  assert.deepEqual(checkCompliance(db, ''), []);
  assert.deepEqual(checkCompliance(db, '   '), []);
  assert.deepEqual(checkCompliance(db, null), []);

  db.close();
  clearComplianceRuleCache();
});

test('警告のみなら hasBlocking は false', () => {
  const db = createDb([PRESSURE]);

  const results = checkCompliance(db, '早めに返事をいただけると助かります');
  assert.equal(results.length, 1);
  assert.equal(hasBlocking(results), false);

  db.close();
  clearComplianceRuleCache();
});

test('検査対象は人事のみで、学生の発言は対象外', () => {
  assert.equal(isCheckedRole(ROLE.HR), true);
  assert.equal(isCheckedRole(ROLE.ADMIN), true);
  assert.equal(isCheckedRole(ROLE.STUDENT), false);
});

test('除外語はカンマ区切りでいずれか1つ一致すれば除外する', () => {
  assert.equal(isExcluded('本籍はお伺いしません', 'お伺いしません,伺いません'), true);
  assert.equal(isExcluded('本籍については伺いません', 'お伺いしません,伺いません'), true);
  assert.equal(isExcluded('ご本籍はどちらですか', 'お伺いしません,伺いません'), false);
  assert.equal(isExcluded('ご本籍はどちらですか', null), false);
  assert.equal(isExcluded('ご本籍はどちらですか', ''), false);
  assert.equal(isExcluded('本籍はお伺いしません', ' お伺いしません , '), true, '空白と空要素を無視する');
});

test('該当箇所は前後20文字だけを切り出す（本文全体を残さない）', () => {
  const long = `${'あ'.repeat(50)}ご本籍はどちらですか${'い'.repeat(50)}`;
  const matched = extractMatchContext(long, '本籍');

  assert.ok(matched.includes('本籍'));
  assert.ok(matched.startsWith('…') && matched.endsWith('…'), '前後が省略される');
  assert.ok(matched.length < 50, `本文全体を含まない（実際 ${matched.length} 文字）`);

  // 短い本文なら省略記号は付かない
  assert.equal(extractMatchContext('ご本籍は', '本籍'), 'ご本籍は');
  assert.equal(extractMatchContext('該当なし', '本籍'), '');
});

test('サロゲートペアを含む本文でも該当箇所が壊れない', () => {
  const body = `${'🙏'.repeat(30)}ご本籍はどちらですか`;
  const matched = extractMatchContext(body, '本籍');

  assert.ok(matched.includes('本籍'));
  assert.ok(!matched.includes('�'), '文字化けが起きない');
  assert.ok(matched.includes('🙏'), '直前の絵文字が正しく切り出される');
});
