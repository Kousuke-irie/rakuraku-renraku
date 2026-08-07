// 面接アンケートの自由記述をAIでまとめる（S-11）。
//
// 人事が読みたいのは「30件の原文」ではなく「この面接官の面接で、学生が何を良いと
// 感じ、何に引っかかったか」。原文は根拠として下に並べ、上に要約を置く。
//
// ★外部（Gemini）へ送るのは自由記述の本文と★だけ。
//   学生名・大学名・ルームID・面接日時は送らない。そもそも listComments が
//   返さない（interviewSurveys.js の匿名化がここでも効いている）。
//
// 構造は services/aiSummary.js（P3-1a）に合わせている。キャッシュの持ち方、
// 多重呼び出しの束ね方、失敗時の状態は同じ考え方で読めるようにするため。

import { AI_SUMMARY_STATUS, INTERVIEW_SURVEY_SCOPE_ALL } from '../../shared/constants.js';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/gemini.js';
import { listComments } from './interviewSurveys.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const INTERVIEW_SURVEY_AI_TIMEOUT_MS = 8_000;

/** 箇条書きの上限。多いと「で、結局どこを直すのか」が読み取れなくなる */
export const INTERVIEW_SURVEY_AI_POINT_LIMIT = 4;

const OUTPUT_SCHEMA = Object.freeze({
  type: 'OBJECT',
  properties: {
    overview: {
      type: 'STRING',
      description: '回答全体の傾向を述べる、簡潔な日本語の1〜2文',
    },
    positives: {
      type: 'ARRAY',
      maxItems: INTERVIEW_SURVEY_AI_POINT_LIMIT,
      items: { type: 'STRING', description: '学生が良いと感じた点を示す短い日本語' },
    },
    concerns: {
      type: 'ARRAY',
      maxItems: INTERVIEW_SURVEY_AI_POINT_LIMIT,
      items: { type: 'STRING', description: '学生が不満・不安に感じた点を示す短い日本語' },
    },
  },
  required: ['overview', 'positives', 'concerns'],
});

/** @type {Map<string, object>} スコープID → 生成結果 */
const summaryCache = new Map();
/** @type {Map<string, Promise<object>>} */
const inFlightRequests = new Map();

function emptyState(status, error = null) {
  return { status, overview: '', positives: [], concerns: [], generatedAt: null, error };
}

/**
 * キャッシュのキー。**回答件数を混ぜる。**
 * 新しい回答が入っても古い要約を返し続ける、を防ぐ最小の仕掛け。
 */
function cacheKey(scopeId, commentCount) {
  return `${scopeId}:${commentCount}`;
}

function buildPrompt(comments) {
  return [
    'あなたは新卒採用の面接体験を改善する分析アシスタントです。',
    '与えられた面接アンケートの自由記述だけを根拠に、日本語でまとめてください。',
    `positives と concerns はそれぞれ最大${INTERVIEW_SURVEY_AI_POINT_LIMIT}件です。`,
    '複数の回答に共通して現れる内容を優先し、1件だけの意見を全体の傾向として書かないでください。',
    '各項目は40文字以内の体言止めにしてください。',
    '該当する内容が無ければ空配列にしてください。無理に項目を作らないでください。',
    '入力に無い事実、学生個人を特定する記述、面接官への人格評価を書かないでください。',
    `入力JSON: ${JSON.stringify(comments)}`,
  ].join('\n');
}

function responseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text ?? '').join('');
}

/** モデル出力から使える形だけを取り出す。長さと件数はこちらで必ず切る */
function validateOutput(value, generatedAt) {
  if (!value || typeof value !== 'object') throw new Error('invalid_json');

  const overview = typeof value.overview === 'string' ? value.overview.trim() : '';
  if (!overview) throw new Error('invalid_json');

  const toPoints = (input) => {
    if (!Array.isArray(input)) throw new Error('invalid_json');
    return input
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, INTERVIEW_SURVEY_AI_POINT_LIMIT)
      .map((item) => item.slice(0, 60));
  };

  return {
    status: AI_SUMMARY_STATUS.READY,
    overview: overview.slice(0, 200),
    positives: toPoints(value.positives),
    concerns: toPoints(value.concerns),
    generatedAt,
    error: null,
  };
}

async function requestGemini({ comments, apiKey, model, fetchImpl, now }) {
  const response = await fetchImpl(
    `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(comments) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
          responseSchema: OUTPUT_SCHEMA,
        },
      }),
      signal: globalThis.AbortSignal.timeout(INTERVIEW_SURVEY_AI_TIMEOUT_MS),
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
  if (!text) throw new Error('empty_response');
  return validateOutput(JSON.parse(text), new Date(now()).toISOString());
}

/**
 * 指定スコープの要約を返す。生成済みならキャッシュから即返す。
 *
 * ★スコープの匿名性判定は listComments に任せる。
 *   回答が少ない面接官はコメントが空で返るので、要約も作らない。
 *   ここで独自に判定を書かないこと（閾値が2箇所に散る）。
 *
 * @param {string} scopeId 'all' / 面接官ID / 'unknown'
 */
export function generateInterviewSurveySummary(
  db,
  {
    scopeId = INTERVIEW_SURVEY_SCOPE_ALL,
    force = false,
    apiKey = GEMINI_API_KEY,
    model = GEMINI_MODEL,
    fetchImpl = globalThis.fetch,
    now = Date.now,
  } = {},
) {
  if (!apiKey) return Promise.resolve(emptyState(AI_SUMMARY_STATUS.UNAVAILABLE));

  const { isSuppressed, comments } = listComments(db, scopeId);
  // 要約する材料が無いのは失敗ではない。原文リストだけを出す IDLE として返す
  if (isSuppressed || comments.length === 0) {
    return Promise.resolve(emptyState(AI_SUMMARY_STATUS.IDLE));
  }

  const key = cacheKey(scopeId, comments.length);
  const inFlight = inFlightRequests.get(key);
  if (inFlight) return inFlight;

  const cached = summaryCache.get(key);
  if (!force && cached?.status === AI_SUMMARY_STATUS.READY) return Promise.resolve(cached);

  // ★本文と★だけを送る。ステップ名すら送らない（面接官と組み合わせると絞り込める）
  const payload = comments.map((comment) => ({ rating: comment.rating, body: comment.body }));

  const promise = (async () => {
    try {
      const result = await requestGemini({ comments: payload, apiKey, model, fetchImpl, now });
      summaryCache.set(key, result);
      return result;
    } catch (error) {
      const message =
        error?.name === 'TimeoutError' || error?.name === 'AbortError'
          ? 'Gemini API が応答しませんでした。下の原文をご確認ください。'
          : 'Gemini API で要約を生成できませんでした。下の原文をご確認ください。';
      const failed = emptyState(AI_SUMMARY_STATUS.ERROR, message);
      summaryCache.set(key, failed);
      // 自由記述の本文と Google のエラー本文は出さず、切り分けに必要な状態だけ残す
      console.warn(
        `server: interview survey AI summary failed` +
          ` (type=${error?.name ?? 'Error'}, http=${error?.httpStatus ?? '-'}, api=${error?.apiStatus ?? '-'})`,
      );
      return failed;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

/** テストとプロセス内キャッシュの明示的な破棄用。 */
export function clearInterviewSurveyAiCache() {
  summaryCache.clear();
  inFlightRequests.clear();
}
