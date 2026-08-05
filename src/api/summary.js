import { http } from "./client.js"

/**
 * 未対応サマリーエンドポイント（api.md §2 / P1-8）
 *
 * 初回ロードはこの REST、以降の更新は socket `summary:updated` で受ける
 * （api.md §1 責務分担）。
 */
export const summaryApi = {
  /**
   * GET /api/summary
   * → `{ needsReply: number, urgent: number, overdue24h: number, unassigned: number }`
   */
  get: () => http.get("/summary"),
}

export default summaryApi
