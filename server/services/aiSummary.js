import {
  AI_SUMMARY_STATUS,
  AI_SUMMARY_TODO_LIMIT,
  HANDLING_STATUS_META,
  LAST_MESSAGE_PREVIEW_LENGTH,
  SELECTION_STATUS_META,
  TOPIC_TAG_META,
  URGENCY_META,
} from '../../shared/constants.js';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/gemini.js';
import { getSummary } from './summary.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const AI_SUMMARY_TIMEOUT_MS = 3_000;

const OUTPUT_SCHEMA = Object.freeze({
  // generateContent v1beta の responseSchema は OpenAPI Schema の列挙値を使う。
  type: 'OBJECT',
  properties: {
    situation: {
      type: 'STRING',
      description: '人事担当者が現在置かれている状況を説明する、簡潔な日本語の1〜2文',
    },
    todos: {
      type: 'ARRAY',
      maxItems: AI_SUMMARY_TODO_LIMIT,
      items: {
        type: 'OBJECT',
        properties: {
          roomId: { type: 'INTEGER' },
          studentName: { type: 'STRING' },
          action: { type: 'STRING', description: '動詞で終わる短い日本語の行動' },
          reason: { type: 'STRING', description: '優先する根拠を示す短い日本語' },
        },
        required: ['roomId', 'studentName', 'action', 'reason'],
      },
    },
  },
  required: ['situation', 'todos'],
});

/** @type {Map<number, object>} */
const summaryCache = new Map();
/** @type {Map<number, Promise<object>>} */
const inFlightRequests = new Map();

function emptyState(status, error = null) {
  return {
    status,
    situation: '',
    todos: [],
    generatedAt: null,
    error,
  };
}

function preview(body) {
  if (!body) return '';
  return Array.from(body).slice(0, LAST_MESSAGE_PREVIEW_LENGTH).join('');
}

function elapsedHours(isoString, now) {
  if (!isoString) return null;
  const value = (now - new Date(isoString).getTime()) / 3_600_000;
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 10) / 10) : null;
}

/**
 * Gemini へ渡す情報をルーム一覧から組み立てる。
 * 会話全文、メールアドレス、ログインID、メモは外部へ送らない。
 */
export function buildAiSummaryInput(db, userId, now = Date.now()) {
  const rows = db
    .prepare(
      `SELECT
         r.id AS roomId,
         su.display_name AS studentName,
         st.selection_status AS selectionStatus,
         r.handling_status AS handlingStatus,
         r.urgency,
         r.last_student_message_at AS lastStudentMessageAt,
         lm.body AS lastMessageBody,
         sm.topic_tag AS topicTag
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id
       JOIN users su ON su.id = r.student_user_id
       LEFT JOIN students st ON st.user_id = su.id
       LEFT JOIN messages lm ON lm.id = r.last_message_id
       LEFT JOIN messages sm ON sm.id = (
         SELECT m.id
         FROM messages m
         WHERE m.room_id = r.id
           AND m.sender_id = r.student_user_id
           AND m.deleted_at IS NULL
         ORDER BY m.id DESC
         LIMIT 1
       )
       WHERE rm.user_id = ?
       ORDER BY
         CASE r.urgency WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
         CASE r.handling_status WHEN 'needs_reply' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         r.last_student_message_at ASC,
         r.id ASC`,
    )
    .all(userId);

  return {
    counts: getSummary(db, now),
    rooms: rows.map((row) => ({
      roomId: row.roomId,
      studentName: row.studentName,
      selectionStatus: SELECTION_STATUS_META[row.selectionStatus]?.label ?? row.selectionStatus,
      handlingStatus: HANDLING_STATUS_META[row.handlingStatus]?.label ?? row.handlingStatus,
      topicTag: TOPIC_TAG_META[row.topicTag]?.label ?? row.topicTag ?? '未分類',
      urgency: URGENCY_META[row.urgency]?.label ?? row.urgency,
      elapsedHours: elapsedHours(row.lastStudentMessageAt, now),
      lastMessageExcerpt: preview(row.lastMessageBody),
    })),
  };
}

function buildPrompt(input) {
  return [
    'あなたは新卒採用チームの業務整理アシスタントです。',
    '与えられた集計値とルーム一覧だけを根拠に、日本語で現況と次の行動をまとめてください。',
    `TODOは最大${AI_SUMMARY_TODO_LIMIT}件です。緊急、要返信、経過時間が長い順を優先してください。`,
    '完了・保留・学生からの返信待ちは、原則としてTODOに含めないでください。',
    'actionは「〜に返信する」「〜を確認する」のように、実行可能な動詞で終えてください。',
    'reasonは緊急度、用件、経過時間のいずれかを短く示してください。',
    '一覧に存在しないroomIdや学生名、事実を作らないでください。',
    `入力JSON: ${JSON.stringify(input)}`,
  ].join('\n');
}

function responseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text ?? '').join('');
}

function validateOutput(value, rooms, generatedAt) {
  if (!value || typeof value !== 'object') throw new Error('invalid_json');
  const situation = typeof value.situation === 'string' ? value.situation.trim() : '';
  if (!situation || !Array.isArray(value.todos) || value.todos.length > AI_SUMMARY_TODO_LIMIT) {
    throw new Error('invalid_json');
  }

  const roomsById = new Map(rooms.map((room) => [room.roomId, room]));
  const seenRoomIds = new Set();
  const todos = value.todos.map((todo) => {
    const roomId = Number(todo?.roomId);
    const room = roomsById.get(roomId);
    const action = typeof todo?.action === 'string' ? todo.action.trim() : '';
    const reason = typeof todo?.reason === 'string' ? todo.reason.trim() : '';
    if (!Number.isInteger(roomId) || !room || seenRoomIds.has(roomId) || !action || !reason) {
      throw new Error('invalid_json');
    }
    seenRoomIds.add(roomId);
    return {
      roomId,
      // 表示名はモデル出力を信用せず、DB由来の値で固定する。
      studentName: room.studentName,
      action: action.slice(0, 80),
      reason: reason.slice(0, 100),
    };
  });

  return {
    status: AI_SUMMARY_STATUS.READY,
    situation: situation.slice(0, 300),
    todos,
    generatedAt,
    error: null,
  };
}

async function requestGemini({ input, apiKey, model, fetchImpl, now }) {
  const response = await fetchImpl(
    `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600,
          // v1beta generateContent ではこの互換形式を使う。
          // responseFormat.text.mimeType は同じモデルでも INVALID_ARGUMENT になる。
          responseMimeType: 'application/json',
          responseSchema: OUTPUT_SCHEMA,
        },
      }),
      signal: globalThis.AbortSignal.timeout(AI_SUMMARY_TIMEOUT_MS),
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
  return validateOutput(JSON.parse(text), input.rooms, new Date(now()).toISOString());
}

export function getAiSummaryState(userId, { apiKey = GEMINI_API_KEY } = {}) {
  if (!apiKey) return emptyState(AI_SUMMARY_STATUS.UNAVAILABLE);
  return summaryCache.get(Number(userId)) ?? emptyState(AI_SUMMARY_STATUS.IDLE);
}

/**
 * 生成を開始し、同じユーザーの多重呼び出しは1本へまとめる。
 * ログイン時は force=false、カードの更新操作だけ force=true で呼ぶ。
 */
export function generateAiSummary(
  db,
  {
    userId,
    force = false,
    apiKey = GEMINI_API_KEY,
    model = GEMINI_MODEL,
    fetchImpl = globalThis.fetch,
    now = Date.now,
  },
) {
  const numericUserId = Number(userId);
  if (!apiKey) {
    const unavailable = emptyState(AI_SUMMARY_STATUS.UNAVAILABLE);
    summaryCache.set(numericUserId, unavailable);
    return Promise.resolve(unavailable);
  }

  const inFlight = inFlightRequests.get(numericUserId);
  if (inFlight) return inFlight;

  const cached = summaryCache.get(numericUserId);
  if (!force && cached?.status === AI_SUMMARY_STATUS.READY) return Promise.resolve(cached);

  summaryCache.set(numericUserId, emptyState(AI_SUMMARY_STATUS.LOADING));
  const promise = (async () => {
    try {
      const input = buildAiSummaryInput(db, numericUserId, now());
      const result = await requestGemini({ input, apiKey, model, fetchImpl, now });
      summaryCache.set(numericUserId, result);
      return result;
    } catch (error) {
      const message =
        error?.name === 'TimeoutError' || error?.name === 'AbortError'
          ? 'Gemini API が3秒以内に応答しませんでした。もう一度お試しください。'
          : 'Gemini APIで要約を生成できませんでした。もう一度お試しください。';
      const failed = emptyState(AI_SUMMARY_STATUS.ERROR, message);
      summaryCache.set(numericUserId, failed);
      // 本文、氏名、Googleのエラー本文を出さず、切り分けに必要な状態だけを残す。
      console.warn(
        `server: Gemini AI summary failed` +
          ` (type=${error?.name ?? 'Error'}, http=${error?.httpStatus ?? '-'}, api=${error?.apiStatus ?? '-'})`,
      );
      return failed;
    } finally {
      inFlightRequests.delete(numericUserId);
    }
  })();

  inFlightRequests.set(numericUserId, promise);
  return promise;
}

/** テストとプロセス内キャッシュの明示的な破棄用。 */
export function clearAiSummaryCache() {
  summaryCache.clear();
  inFlightRequests.clear();
}
