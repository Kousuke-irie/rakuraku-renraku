/**
 * API 層のエントリポイント（api.md §2）
 *
 * このファイルは re-export のみ。実装はリソース別のファイルに置く
 * （複数人が同時に触るためコンフリクトを避ける）。
 *
 * 各 api オブジェクトは axios のレスポンスをそのまま返す薄いラッパー。
 * エラーハンドリング・状態の反映は Pinia ストア側の責務とする。
 *
 *   import { roomsApi, toErrorMessage } from '../api/index.js'
 *   const { data } = await roomsApi.list({ q: '山田' })
 */
export { http, http as default, toErrorMessage } from "./client.js"

export { authApi } from "./auth.js"
export { roomsApi } from "./rooms.js"
export { messagesApi } from "./messages.js"
export { studentsApi } from "./students.js"
export { usersApi } from "./users.js"
export { memosApi } from "./memos.js"
export { snippetsApi } from "./snippets.js"
export { summaryApi } from "./summary.js"
export { companyApi } from "./company.js"
export { aiSummaryApi } from "./aiSummary.js"
export { schedulesApi } from "./schedules.js"
