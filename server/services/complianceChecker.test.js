import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  ALERT_SEVERITY,
  COMPLIANCE_CATEGORY,
  COMPLIANCE_SOURCE,
  ROLE,
} from '../../shared/constants.js';
import {
  checkCompliance,
  clearComplianceRuleCache,
  extractContextAt,
  hasBlocking,
  isCheckedRole,
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

/** 正規表現ルール。1つの code が複数の言い回しを吸収する */
const FAMILY_JOB = {
  code: 'family_job',
  category: COMPLIANCE_CATEGORY.DISCRIMINATION,
  keyword: '(ご|お)?(両親|父|母|お父様|お母様).{0,12}(職業|お仕事|仕事|勤め)',
  excludeKeyword: null,
  severity: ALERT_SEVERITY.BLOCK,
  message: '家族に関する質問は本人の適性・能力と関係がありません',
  priority: 2,
};

const PRESSURE = {
  code: 'pressure_soft',
  category: COMPLIANCE_CATEGORY.OWAHARA,
  keyword: '(早め|早急).{0,10}(返事|ご判断)',
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
  assert.equal(results[0].severity, ALERT_SEVERITY.BLOCK);
  assert.equal(results[0].source, COMPLIANCE_SOURCE.DICTIONARY, '辞書由来と分かる');

  db.close();
  clearComplianceRuleCache();
});

test('★空白を挟んでも回避できない', () => {
  const db = createDb([HONSEKI]);

  // 照合は正規化済み本文に対して行うので、空白での分断はすり抜けない
  for (const body of ['本 籍はどちらですか', 'ご　本　籍はどちらですか', '本​籍はどちらですか']) {
    assert.equal(checkCompliance(db, body).length, 1, `すり抜けた: ${body}`);
  }

  db.close();
  clearComplianceRuleCache();
});

test('★正規表現で言い回しの揺れを吸収する', () => {
  const db = createDb([FAMILY_JOB]);

  for (const body of [
    'お父様のお仕事は何ですか',
    'ご両親はどんなお仕事をされていますか',
    'お母様のお勤め先を教えてください',
  ]) {
    assert.equal(checkCompliance(db, body).length, 1, `検知できず: ${body}`);
  }

  db.close();
  clearComplianceRuleCache();
});

test('除外語を含む正しい文は検知しない', () => {
  const db = createDb([HONSEKI]);

  assert.deepEqual(checkCompliance(db, '本籍地はお伺いしませんのでご安心ください'), []);
  assert.deepEqual(checkCompliance(db, '本籍については伺いません'), []);

  db.close();
  clearComplianceRuleCache();
});

test('同じ code は複数当たっても1件に畳む', () => {
  const db = createDb([HONSEKI, { ...HONSEKI, keyword: '出身地', priority: 2 }]);

  const results = checkCompliance(db, 'ご本籍と出身地を教えてください');
  assert.equal(results.length, 1);

  db.close();
  clearComplianceRuleCache();
});

test('1通に複数の問題があれば全件を重い順に返す', () => {
  const db = createDb([PRESSURE, HONSEKI]);

  const results = checkCompliance(db, 'ご本籍を教えてください。早めに返事をください');
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => result.severity),
    [ALERT_SEVERITY.BLOCK, ALERT_SEVERITY.WARN],
    'block が warn より先',
  );

  db.close();
  clearComplianceRuleCache();
});

test('該当が無ければ空配列を返す', () => {
  const db = createDb([HONSEKI]);

  assert.deepEqual(checkCompliance(db, '面接日程のご連絡です'), []);
  assert.deepEqual(checkCompliance(db, ''), []);
  assert.deepEqual(checkCompliance(db, '   '), []);
  assert.deepEqual(checkCompliance(db, null), []);

  db.close();
  clearComplianceRuleCache();
});

test('不正な正規表現はリテラルとして扱い、検査全体を壊さない', () => {
  const db = createDb([
    { ...HONSEKI, code: 'broken', keyword: '本籍(', excludeKeyword: null, priority: 0 },
    HONSEKI,
  ]);

  // 壊れたルールは「本籍(」というリテラルとして扱われ、当たらないだけ。
  // 正常な honseki は従来どおり動く
  const results = checkCompliance(db, 'ご本籍はどちらですか');
  assert.deepEqual(results.map((r) => r.code), ['honseki']);

  db.close();
  clearComplianceRuleCache();
});

test('警告のみなら hasBlocking は false', () => {
  const db = createDb([PRESSURE]);

  assert.equal(hasBlocking(checkCompliance(db, '早めに返事をください')), false);

  db.close();
  clearComplianceRuleCache();
});

test('検査対象は人事のみで、学生の発言は対象外', () => {
  assert.equal(isCheckedRole(ROLE.HR), true);
  assert.equal(isCheckedRole(ROLE.ADMIN), true);
  assert.equal(isCheckedRole(ROLE.STUDENT), false);
});

test('該当箇所は前後20文字だけを切り出す（本文全体を残さない）', () => {
  const db = createDb([HONSEKI]);
  const secret = 'あ'.repeat(50);
  const body = `${secret}ご本籍はどちらですか${'い'.repeat(50)}`;

  const [result] = checkCompliance(db, body);
  assert.ok(result.matched.includes('本籍'));
  assert.ok(!result.matched.includes(secret), '無関係な本文を含まない');
  assert.ok(result.matched.startsWith('…') && result.matched.endsWith('…'));

  db.close();
  clearComplianceRuleCache();
});

test('空白除去後も該当箇所は元の本文の位置から切り出す', () => {
  const db = createDb([HONSEKI]);

  const [result] = checkCompliance(db, 'さて、ご本 籍はどちらでしょうか');
  // 正規化後の位置ではなく元の本文の位置を使うので、空白入りのまま見える
  assert.ok(result.matched.includes('本 籍'), `実際: ${result.matched}`);

  db.close();
  clearComplianceRuleCache();
});

test('extractContextAt は範囲外でも壊れない', () => {
  assert.equal(extractContextAt('短い本文', 0, 2), '短い本文');
  assert.equal(extractContextAt('', 0, 0), '');
});
