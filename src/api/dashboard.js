import { http } from "./client.js"

/**
 * 監視ダッシュボード（P4-4 / monitoring.md §6）
 *
 * **閲覧は人事全員（hr / admin）。** 学生ロールでは 403 が返る。
 * リアルタイム更新はしない。開いたときと手動更新でだけ取り直す。
 */
export const dashboardApi = {
  /**
   * GET /api/dashboard → 全社の集計一式
   * `{ kpi, selectionBreakdown, slaByAssignee, slaTrend,
   *    complianceBreakdown, complianceIgnored, escalations, thresholds }`
   */
  get: () => http.get("/dashboard"),

  /**
   * GET /api/dashboard/personal → 担当者1人ぶんの集計（P4-8）
   * `assigneeId` を省略すると自分。
   * `{ assignee, kpi, handlingBreakdown, aiPriorityBreakdown, replyStateBreakdown,
   *    selectionBreakdown, hourlyActivity, replyLatency, thresholds }`
   */
  getPersonal: (assigneeId) =>
    http.get("/dashboard/personal", assigneeId ? { params: { assigneeId } } : undefined),
}

export default dashboardApi
