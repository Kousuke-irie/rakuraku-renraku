// Geminiは任意機能。APIキー未設定でもサーバーの既存機能を起動できるよう、
// 必須環境変数を検証するenv.jsとは分ける。
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
export const AI_PRIORITY_TIMEOUT_MS = Number(process.env.AI_PRIORITY_TIMEOUT_MS) || 3000;

// コンプライアンス判定（P4-2b）は送信前チェックを**待たせる**経路なので、
// 非同期の優先度判定とは別の値を持つ。
// 実測: 温まっていれば中央値約1.0秒・最大1.6秒。初回だけTLSハンドシェイク等で
// 3秒を超えることがあり、AI_PRIORITY_TIMEOUT_MS(3秒)を流用すると1通目が必ず
// error になる。余裕を持たせても、通常は1秒程度で返るので待ち時間は増えない。
export const COMPLIANCE_AI_TIMEOUT_MS = Number(process.env.COMPLIANCE_AI_TIMEOUT_MS) || 8000;
