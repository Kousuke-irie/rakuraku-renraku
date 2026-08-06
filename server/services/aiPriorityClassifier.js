import { AI_RECOMMENDED_PRIORITY_VALUES } from '../../shared/constants.js';
import {
  AI_PRIORITY_TIMEOUT_MS,
  GEMINI_API_KEY,
  GEMINI_MODEL,
} from '../config/gemini.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const OUTPUT_SCHEMA = Object.freeze({
  type: 'OBJECT',
  properties: {
    priority: { type: 'STRING', enum: AI_RECOMMENDED_PRIORITY_VALUES },
    reason: { type: 'STRING' },
    requestedAction: { type: 'STRING' },
    contextSummary: { type: 'STRING', nullable: true },
    needsMoreContext: { type: 'BOOLEAN' },
  },
  required: ['priority', 'reason', 'requestedAction', 'contextSummary', 'needsMoreContext'],
});

const SYSTEM_INSTRUCTION = `あなたは新卒採用の受信箱を整理する補助システムです。
質問は「この学生への対応を、ほかの未対応案件より先に確認する必要があるか」です。
highは、24時間以内の明示期限、24時間以内の予定への人事対応、他社回答期限、辞退検討、同一要望の反復、明確な苦情、未解決による選考停止が具体的に確認できる場合だけです。
文章の強さ、不安そうな表現、丁寧さだけでhighにしないでください。
normalは、人事の返信や処理が必要だが、明確な期限や重大な影響が確認できない場合です。
lowは、お礼、了承、情報共有だけで、追加の人事対応が見当たらない場合です。
提供されていない期限、感情、性格を推測しないでください。
返信文や対応方法は生成しないでください。
reasonは具体的な根拠を日本語で45文字程度、requestedActionは学生の要望を動詞を含む形で書いてください。
背景がなければcontextSummaryをnullにしてください。
最小入力で指示語や会話関係を解決できない場合だけneedsMoreContextをtrueにしてください。
JSONだけを返してください。`;

function responseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text ?? '').join('');
}

function requiredText(value, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid_ai_response');
  return Array.from(value.trim()).slice(0, maxLength).join('');
}

export function validateAiPriorityOutput(value) {
  if (!value || typeof value !== 'object') throw new Error('invalid_ai_response');
  if (!AI_RECOMMENDED_PRIORITY_VALUES.includes(value.priority)) throw new Error('invalid_ai_response');
  if (typeof value.needsMoreContext !== 'boolean') throw new Error('invalid_ai_response');
  if (value.contextSummary !== null && typeof value.contextSummary !== 'string') {
    throw new Error('invalid_ai_response');
  }

  return {
    priority: value.priority,
    reason: requiredText(value.reason, 80),
    requestedAction: requiredText(value.requestedAction, 120),
    contextSummary:
      value.contextSummary === null || !value.contextSummary.trim()
        ? null
        : Array.from(value.contextSummary.trim()).slice(0, 120).join(''),
    needsMoreContext: value.needsMoreContext,
  };
}

async function requestGemini({ input, apiKey, model, timeoutMs, fetchImpl }) {
  const response = await fetchImpl(`${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_INSTRUCTION}\n入力JSON: ${JSON.stringify(input)}` }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: OUTPUT_SCHEMA,
      },
    }),
    signal: globalThis.AbortSignal.timeout(timeoutMs),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('gemini_http_error');
    error.httpStatus = response.status;
    error.apiStatus = payload?.error?.status ?? null;
    throw error;
  }

  const text = responseText(payload);
  if (!text) throw new Error('empty_ai_response');
  return validateAiPriorityOutput(JSON.parse(text));
}

export async function classifyAiPriority({
  minimalInput,
  recentMessagesProvider,
  apiKey = GEMINI_API_KEY,
  model = GEMINI_MODEL,
  timeoutMs = AI_PRIORITY_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
}) {
  const first = await requestGemini({ input: minimalInput, apiKey, model, timeoutMs, fetchImpl });
  if (!first.needsMoreContext) return first;

  const second = await requestGemini({
    input: { ...minimalInput, recentMessages: recentMessagesProvider() },
    apiKey,
    model,
    timeoutMs,
    fetchImpl,
  });
  if (second.needsMoreContext) throw new Error('insufficient_context');
  return second;
}
