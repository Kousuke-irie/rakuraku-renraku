import { http } from "./client.js"

/**
 * 申し送りメモエンドポイント（api.md §2「メモ・定型文・サマリー」/ P2-5・P2-6）
 *
 * memo の形:
 * { id, roomId, author: { id, displayName }, body, scope, createdAt, updatedAt }
 * `scope` は MEMO_SCOPE（private / shared）。private は作成者本人にしか返らない。
 * メモは人事の社内情報なので、学生ロールはどのエンドポイントも 403 になる。
 */
export const memosApi = {
  /**
   * GET /api/rooms/:id/memos → `{ memos: memo[] }`（自分の個人メモ＋共有メモ）
   * @param {number} roomId
   */
  list: (roomId) => http.get(`/rooms/${roomId}/memos`),

  /**
   * POST /api/rooms/:id/memos → `{ memo }`
   * @param {number} roomId
   * @param {{ body: string, scope: string }} payload scope は MEMO_SCOPE のいずれか
   */
  create: (roomId, payload) => http.post(`/rooms/${roomId}/memos`, payload),

  /**
   * PATCH /api/memos/:id → `{ memo }`
   * 本文更新と `scope` の共有昇格（P2-6）の両方に使う。
   * @param {number} memoId
   * @param {{ body?: string, scope?: string }} patch
   */
  update: (memoId, patch) => http.patch(`/memos/${memoId}`, patch),

  /**
   * DELETE /api/memos/:id
   * @param {number} memoId
   */
  remove: (memoId) => http.delete(`/memos/${memoId}`),
}

export default memosApi
