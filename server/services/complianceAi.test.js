import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_SEVERITY,
  COMPLIANCE_AI_STATUS,
  COMPLIANCE_CATEGORY,
  COMPLIANCE_RULE,
  COMPLIANCE_SOURCE,
} from '../../shared/constants.js';
import {
  checkComplianceWithAi,
  clearComplianceAiCache,
  mergeFindings,
  validateAiFindings,
} from './complianceAi.js';

const BODY = 'お父様のお仕事は何ですか';

const FINDING = {
  ruleCode: COMPLIANCE_RULE.FAMILY_JOB,
  severity: ALERT_SEVERITY.BLOCK,
  quote: 'お父様のお仕事',
  message: '家族の職業を尋ねているおそれがあります',
};

test('APIキーが無ければ呼ばずに unavailable を返す', async () => {
  clearComplianceAiCache();

  const result = await checkComplianceWithAi(BODY, {
    apiKey: '',
    fetchImpl: () => assert.fail('APIキーが無いのに呼び出した'),
  });

  assert.equal(result.status, COMPLIANCE_AI_STATUS.UNAVAILABLE);
  assert.deepEqual(result.results, []);
});

test('タイムアウト・APIエラーは error を返すだけで例外を投げない', async () => {
  clearComplianceAiCache();

  const timedOut = await checkComplianceWithAi(BODY, {
    apiKey: 'k',
    fetchImpl: async () => { throw new Error('TimeoutError'); },
  });
  assert.equal(timedOut.status, COMPLIANCE_AI_STATUS.ERROR);
  assert.deepEqual(timedOut.results, []);

  clearComplianceAiCache();
  const httpError = await checkComplianceWithAi(BODY, {
    apiKey: 'k',
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED' } }) }),
  });
  assert.equal(httpError.status, COMPLIANCE_AI_STATUS.ERROR);
});

test('JSON が壊れていても error に落ちるだけ', async () => {
  clearComplianceAiCache();

  const result = await checkComplianceWithAi(BODY, {
    apiKey: 'k',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{壊れた' }] } }] }),
    }),
  });

  assert.equal(result.status, COMPLIANCE_AI_STATUS.ERROR);
});

test('同じ本文は2回目に API を呼ばない（キャッシュ）', async () => {
  clearComplianceAiCache();
  let calls = 0;

  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ findings: [FINDING] }) }] } }],
      }),
    };
  };

  await checkComplianceWithAi(BODY, { apiKey: 'k', fetchImpl });
  const second = await checkComplianceWithAi(BODY, { apiKey: 'k', fetchImpl });

  assert.equal(calls, 1, '送信前チェックと送信後の記録で2回投げない');
  assert.equal(second.results.length, 1);

  clearComplianceAiCache();
});

test('入力に無い引用は捨てる（モデルの作文を表示しない）', () => {
  const findings = validateAiFindings(
    { findings: [{ ...FINDING, quote: '実際には書いていない文' }] },
    BODY,
  );

  assert.deepEqual(findings, []);
});

test('enum 外・型違いの項目は捨てる', () => {
  const findings = validateAiFindings(
    {
      findings: [
        // 辞書に無い独自コード（ai_xxx など）は作らせない
        { ...FINDING, ruleCode: 'ai_discrimination' },
        { ...FINDING, ruleCode: 'unknown_rule' },
        { ...FINDING, severity: 'fatal' },
        { ...FINDING, message: '' },
        { ...FINDING, quote: 123 },
        FINDING,
      ],
    },
    BODY,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, COMPLIANCE_RULE.FAMILY_JOB, '辞書と同じ語彙になる');
  assert.equal(findings[0].category, COMPLIANCE_CATEGORY.DISCRIMINATION, 'カテゴリはコードから引く');
  assert.equal(findings[0].source, COMPLIANCE_SOURCE.AI);
});

test('findings が配列でなければ例外', () => {
  assert.throws(() => validateAiFindings({}, BODY), /invalid_ai_response/);
  assert.throws(() => validateAiFindings(null, BODY), /invalid_ai_response/);
});

test('同じルールが複数返ってきたら重い方を1件残す', () => {
  const findings = validateAiFindings(
    {
      findings: [
        { ...FINDING, severity: ALERT_SEVERITY.WARN, quote: 'お父様' },
        { ...FINDING, severity: ALERT_SEVERITY.BLOCK, quote: 'お父様のお仕事' },
      ],
    },
    BODY,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, ALERT_SEVERITY.BLOCK);
});

test('★辞書が既に拾った「ルール」だけ AI 分を落とす（カテゴリ単位では落とさない）', () => {
  const make = (code, category, severity, source) => ({
    code, category, severity, source, message: 'x', matched: 'y',
  });

  const dictionary = [
    make(COMPLIANCE_RULE.HONSEKI, COMPLIANCE_CATEGORY.DISCRIMINATION, ALERT_SEVERITY.BLOCK, COMPLIANCE_SOURCE.DICTIONARY),
  ];
  const ai = [
    // 同じルール → 重複なので落とす
    make(COMPLIANCE_RULE.HONSEKI, COMPLIANCE_CATEGORY.DISCRIMINATION, ALERT_SEVERITY.WARN, COMPLIANCE_SOURCE.AI),
    // 同じカテゴリだが別のルール → **残す**。カテゴリ単位で落とすと別論点が消える
    make(COMPLIANCE_RULE.RELIGION, COMPLIANCE_CATEGORY.DISCRIMINATION, ALERT_SEVERITY.WARN, COMPLIANCE_SOURCE.AI),
    make(COMPLIANCE_RULE.OTHER_OWAHARA, COMPLIANCE_CATEGORY.OWAHARA, ALERT_SEVERITY.WARN, COMPLIANCE_SOURCE.AI),
  ];

  const merged = mergeFindings(dictionary, ai);
  assert.deepEqual(merged.map((f) => f.code), [
    COMPLIANCE_RULE.HONSEKI,
    COMPLIANCE_RULE.RELIGION,
    COMPLIANCE_RULE.OTHER_OWAHARA,
  ]);
});

test('空文字はAPIを呼ばずに ok を返す', async () => {
  clearComplianceAiCache();

  const result = await checkComplianceWithAi('   ', {
    apiKey: 'k',
    fetchImpl: () => assert.fail('空文字で呼び出した'),
  });

  assert.equal(result.status, COMPLIANCE_AI_STATUS.OK);
  assert.deepEqual(result.results, []);
});
