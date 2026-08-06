import { http } from "./client.js"

/**
 * 通知エンドポイント（P4-1 / monitoring.md §3）
 *
 * alert の形:
 * { id, kind, severity, roomId, studentName, assigneeName, detail,
 *   createdAt, readAt, resolvedAt, elapsedHours }
 *
 * **自分宛のものしか返らない。** 他人宛の id を指定すると 404。
 * コンプライアンス警告（target_user_id が NULL）はここには出ない。
 */
export const alertsApi = {
  /**
   * GET /api/alerts → `{ alerts: alert[], unreadCount: number }`
   *
   * 既定では解消済み（返信して片付いたもの）を含めない。
   * @param {{ unread?: boolean, includeResolved?: boolean, limit?: number }} [params]
   */
  list: (params) => http.get("/alerts", { params }),

  /** POST /api/alerts/:id/read → `{ unreadCount }` */
  markRead: (alertId) => http.post(`/alerts/${alertId}/read`),

  /** POST /api/alerts/read-all → `{ updated, unreadCount }` */
  markAllRead: () => http.post("/alerts/read-all"),
}

export default alertsApi
