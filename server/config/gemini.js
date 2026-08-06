// Geminiは任意機能。APIキー未設定でもサーバーの既存機能を起動できるよう、
// 必須環境変数を検証するenv.jsとは分ける。
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
export const AI_PRIORITY_TIMEOUT_MS = Number(process.env.AI_PRIORITY_TIMEOUT_MS) || 3000;
