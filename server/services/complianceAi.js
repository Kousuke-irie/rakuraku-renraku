// P4-2b: LLM による就職差別・オワハラ判定。
//
// 辞書（complianceChecker.js）は部分一致なので、言い換え・迂回表現を原理的に拾えない。
//   「お父様のお仕事は何ですか」＝ 家族の職業を尋ねているが辞書には無い
//   「弊社一本に絞っていただけませんか」＝ オワハラだが辞書には無い
// そこを埋めるのがこのファイル。
//
// ★汎用のモデレーションAPI（toxicity / hate 系）は使えない。
//   「ご本籍はどちらですか」は丁寧で攻撃性ゼロなのでスコアが立たない。
//   測る軸が違うので、厚労省の基準を**こちらから定義して**渡す。
//
// 失敗しても業務を止めない：タイムアウト・APIエラー・JSON不正はすべて
// status='error' を返すだけで、辞書判定の結果はそのまま生きる（business-logic.md §7）。
import {
  ALERT_SEVERITY,
  ALERT_SEVERITY_ORDER,
  ALERT_SEVERITY_VALUES,
  COMPLIANCE_AI_STATUS,
  COMPLIANCE_CATEGORY_VALUES,
  COMPLIANCE_SOURCE,
} from '../../shared/constants.js';
import { COMPLIANCE_AI_TIMEOUT_MS, GEMINI_API_KEY, GEMINI_MODEL } from '../config/gemini.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** AI が返してよい件数の上限。多すぎるとダイアログが読めなくなる */
const MAX_AI_FINDINGS = 3;

/**
 * 同じ本文を2回判定しないための短期キャッシュ。
 * 送信前チェックと、送信後の記録の2回で同じ本文を投げるため。
 */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map();

const OUTPUT_SCHEMA = Object.freeze({
  type: 'OBJECT',
  properties: {
    findings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: COMPLIANCE_CATEGORY_VALUES },
          severity: { type: 'STRING', enum: ALERT_SEVERITY_VALUES },
          quote: { type: 'STRING' },
          message: { type: 'STRING' },
        },
        required: ['category', 'severity', 'quote', 'message'],
      },
    },
  },
  required: ['findings'],
});

const SYSTEM_INSTRUCTION = `あなたは新卒採用の人事が学生へ送る文面を点検する補助システムです。
入力は人事が送ろうとしている文面です。学生の発言ではありません。

discrimination は、厚生労働省「公正な採用選考の基本」で尋ねてはならないとされる事項を、
学生に尋ねる・答えさせようとしている場合だけです。該当するのは次の事項です。
本籍・出生地、家族の職業や続柄や地位や学歴や収入、住宅の状況、生活環境や家庭環境、
宗教、支持政党、人生観や信条、尊敬する人物、思想、労働組合や学生運動などの社会運動、
購読新聞や愛読書。
言い換えや遠回しな聞き方も対象です。例えば「お父様のお仕事は」は家族の職業を尋ねています。
その事項に触れているだけで、学生に尋ねていない文は該当しません。
例えば「弊社は労働組合と協議して制度を改定しました」は説明であって質問ではないので該当しません。
「本籍はお伺いしません」のような、尋ねないと明言している文も該当しません。

owahara は、学生の就職活動の自由を制約しようとしている場合だけです。
他社の選考の辞退や就職活動の終了を求める、内定を交換条件にする、その場での即答を強要する、
極端に短い回答期限で判断を迫る、が該当します。
通常の業務連絡や、余裕のある期限の提示は該当しません。

severity は、上記に明確に当てはまるなら block、判断に迷う程度なら warn にしてください。
確信が持てない場合は findings に含めないでください。**見逃しより誤検知の方が有害です。**

quote は該当する部分を入力からそのまま最大40文字で抜き出してください。要約しないでください。
message は何が問題かを日本語40文字程度で書いてください。断定を避け「おそれがあります」の形にしてください。
返信文や修正案は生成しないでください。
問題が無ければ findings を空配列にしてください。findings は最大3件です。
JSONだけを返してください。`;

function cacheKey(body) {
  return body;
}

function readCache(body) {
  const entry = cache.get(cacheKey(body));
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(cacheKey(body));
    return null;
  }
  return entry.value;
}

function writeCache(body, value) {
  // 素朴な FIFO。長寿命プロセスで無制限に太らせない
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(cacheKey(body), { at: Date.now(), value });
}

/** テスト用。プロセス内キャッシュを捨てる。 */
export function clearComplianceAiCache() {
  cache.clear();
}

function responseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text ?? '').join('');
}

/**
 * モデルの出力を検証して整える。
 * enum 外・型違い・空文字は落とす。AI の出力をそのまま画面に流さない。
 */
export function validateAiFindings(value, body) {
  if (!value || !Array.isArray(value.findings)) throw new Error('invalid_ai_response');

  const findings = [];

  for (const finding of value.findings) {
    if (!COMPLIANCE_CATEGORY_VALUES.includes(finding?.category)) continue;
    if (!ALERT_SEVERITY_VALUES.includes(finding?.severity)) continue;
    if (typeof finding.message !== 'string' || !finding.message.trim()) continue;
    if (typeof finding.quote !== 'string' || !finding.quote.trim()) continue;

    const quote = Array.from(finding.quote.trim()).slice(0, 40).join('');
    // 入力に無い文字列を引用として出さない（モデルの作文をそのまま見せない）
    if (!body.includes(quote)) continue;

    findings.push({
      // AI 由来は rule_code を code として持たないので、カテゴリで識別する
      code: `ai_${finding.category}`,
      category: finding.category,
      // AI 単独の指摘で送信を止めるのは誤検知の影響が大きい。warn を上限にする
      severity: finding.severity === ALERT_SEVERITY.BLOCK ? ALERT_SEVERITY.BLOCK : ALERT_SEVERITY.WARN,
      message: Array.from(finding.message.trim()).slice(0, 80).join(''),
      source: COMPLIANCE_SOURCE.AI,
      matched: quote,
    });
  }

  // 同じカテゴリで複数返ってきたら重い方を1件だけ残す
  const byCode = new Map();
  for (const finding of findings) {
    const existing = byCode.get(finding.code);
    if (existing && ALERT_SEVERITY_ORDER[existing.severity] <= ALERT_SEVERITY_ORDER[finding.severity]) continue;
    byCode.set(finding.code, finding);
  }

  return [...byCode.values()]
    .sort((a, b) => ALERT_SEVERITY_ORDER[a.severity] - ALERT_SEVERITY_ORDER[b.severity])
    .slice(0, MAX_AI_FINDINGS);
}

async function requestGemini({ body, apiKey, model, timeoutMs, fetchImpl }) {
  const response = await fetchImpl(
    `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n点検する文面:\n${body}` }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 600,
          responseMimeType: 'application/json',
          responseSchema: OUTPUT_SCHEMA,
        },
      }),
      signal: globalThis.AbortSignal.timeout(timeoutMs),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('gemini_http_error');
    error.httpStatus = response.status;
    error.apiStatus = payload?.error?.status ?? null;
    throw error;
  }

  const text = responseText(payload);
  if (!text) throw new Error('empty_ai_response');
  return validateAiFindings(JSON.parse(text), body);
}

/**
 * LLM で本文を点検する。**例外を投げない。**
 *
 * @returns {Promise<{status: string, results: object[]}>}
 *   status='ok' なら results が有効。error / unavailable のとき results は空。
 */
export async function checkComplianceWithAi(
  body,
  {
    apiKey = GEMINI_API_KEY,
    model = GEMINI_MODEL,
    timeoutMs = COMPLIANCE_AI_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (typeof body !== 'string' || body.trim() === '') {
    return { status: COMPLIANCE_AI_STATUS.OK, results: [] };
  }
  if (!apiKey) {
    return { status: COMPLIANCE_AI_STATUS.UNAVAILABLE, results: [] };
  }

  const cached = readCache(body);
  if (cached) return cached;

  try {
    const results = await requestGemini({ body, apiKey, model, timeoutMs, fetchImpl });
    const value = { status: COMPLIANCE_AI_STATUS.OK, results };
    writeCache(body, value);
    return value;
  } catch (error) {
    // 本文・学生氏名は絶対に出さない（CLAUDE.md §6-8）
    console.warn(
      'server: compliance AI check failed' +
        ` (type=${error?.name ?? 'Error'}, http=${error?.httpStatus ?? '-'}, api=${error?.apiStatus ?? '-'})`,
    );
    return { status: COMPLIANCE_AI_STATUS.ERROR, results: [] };
  }
}

/**
 * 辞書と AI の結果を1本にまとめる。
 * 辞書が既に同じカテゴリを block で拾っている場合、AI の同カテゴリは重複なので落とす。
 */
export function mergeFindings(dictionaryResults, aiResults) {
  const coveredCategories = new Set(dictionaryResults.map((result) => result.category));
  const merged = [
    ...dictionaryResults,
    ...aiResults.filter((result) => !coveredCategories.has(result.category)),
  ];

  return merged.sort(
    (a, b) => ALERT_SEVERITY_ORDER[a.severity] - ALERT_SEVERITY_ORDER[b.severity],
  );
}
