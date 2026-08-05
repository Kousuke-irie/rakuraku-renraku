import { http } from "./client.js"

/**
 * メッセージエンドポイント（api.md §2「メッセージ」）
 *
 * message の形:
 * { id, roomId, senderId, type, body, topicTag, clientMsgId, createdAt, deletedAt }
 *
 * 通常の送信は socket `message:send`。ここの `create` は**切断時のフォールバック専用**
 * （api.md §1 責務分担）。
 */
export const messagesApi = {
  /**
   * GET /api/rooms/:id/messages → `{ messages: message[], hasMore?: boolean }`
   *
   * - **レスポンスは createdAt の降順**。昇順への並べ替えは messages ストアの責務
   * - `before` によるキーセットページネーション。`OFFSET` は使わない（CLAUDE.md §6-9）
   *
   * @param {number} roomId
   * @param {{ before?: number, limit?: number }} [params] before = そのIDより古いものを取得
   */
  list: (roomId, params) => http.get(`/rooms/${roomId}/messages`, { params }),

  /**
   * POST /api/rooms/:id/messages → `{ message }`
   * socket 切断時のフォールバック送信。`clientMsgId` により再送でも二重保存されない
   * （api.md §4-3）。
   * @param {number} roomId
   * @param {{ body: string, clientMsgId: string }} payload
   */
  create: (roomId, payload) => http.post(`/rooms/${roomId}/messages`, payload),

  /**
   * DELETE /api/messages/:id（送信取消。24h以内・自分のみ）
   * 物理削除ではなく `deletedAt` が設定される。
   * @param {number} messageId
   */
  remove: (messageId) => http.delete(`/messages/${messageId}`),
}

export default messagesApi
