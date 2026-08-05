// エラー応答の形式を `{ error, message }` に統一する（api.md §1）。
// これが無いと想定外の例外が Express 既定の HTML 500 になり、
// クライアントの共通エラーハンドリング（toErrorMessage / 401 検知）が機能しない。
import { RoomAccessDeniedError } from '../services/roomAuth.js';

// 未定義パスも JSON で返す（/api 配下に限定して使う）。
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'not_found', message: 'エンドポイントが存在しません' });
}

// eslint-disable-next-line no-unused-vars -- Express はエラーハンドラを引数4個で識別する
export function errorHandler(err, req, res, next) {
  if (err instanceof RoomAccessDeniedError) {
    return res.status(err.statusCode).json({ error: err.code, message: err.message });
  }

  // ログに個人情報（メッセージ本文・氏名）を出さない（CLAUDE.md §6-8）。
  // 経路とスタックのみ記録する。
  console.error(`server: unhandled error on ${req.method} ${req.originalUrl}`, err.stack);

  res.status(500).json({ error: 'internal_error', message: 'サーバ側でエラーが発生しました' });
}
