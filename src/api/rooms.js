import { http } from "./client.js"

/**
 * ルーム（受信箱）エンドポイント（api.md §2「ルーム」）
 *
 * room の形:
 * {
 *   id, student: { userId, displayName, university, selectionStatus, avatarColor,
 *                  nextInterviewAt, nextInterviewRoom, interviewer, scheduleState },
 *   handlingStatus, urgency, topicTag, isPinned,
 *   assignee: { id, displayName } | null,   // null = 未割当
 *   unreadCount, lastMessage: { id, body, createdAt, senderId } | null,
 *   lastStudentMessageAt, elapsedHours
 * }
 *
 * `elapsedHours` はサーバ算出値。表示の再計算は useElapsedTime が1分ごとに行う（api.md §2）。
 */
export const roomsApi = {
  /**
   * GET /api/rooms → `{ rooms: room[] }`
   * @param {{
   *   handlingStatus?: string|string[], selectionStatus?: string|string[],
   *   topicTag?: string|string[], urgency?: string|string[],
   *   assigneeId?: number|'unassigned', sort?: string, q?: string
   * }} [params] 列挙値は shared/constants.js のものを渡す
   */
  list: (params) => http.get("/rooms", { params }),

  /**
   * GET /api/rooms/:id → `{ room }`（学生プロフィール込み）
   * @param {number} roomId
   */
  get: (roomId) => http.get(`/rooms/${roomId}`),

  /**
   * PATCH /api/rooms/:id → `{ room }`
   * @param {number} roomId
   * @param {{ handlingStatus?: string, assigneeUserId?: number|null, isPinned?: boolean }} patch
   */
  update: (roomId, patch) => http.patch(`/rooms/${roomId}`, patch),

  /**
   * POST /api/rooms/:id/read（既読位置の永続化）
   * リアルタイム通知は socket `message:read` 側の責務（api.md §1 責務分担）。
   * @param {number} roomId
   * @param {number} lastReadMessageId
   */
  markRead: (roomId, lastReadMessageId) =>
    http.post(`/rooms/${roomId}/read`, { lastReadMessageId }),
}

export default roomsApi
