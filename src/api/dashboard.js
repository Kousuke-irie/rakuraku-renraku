import { http } from "./client.js"

/**
 * 監視ダッシュボード（P4-4 / monitoring.md §6）
 *
 * **上長（admin）専用。** それ以外のロールでは 403 が返る。
 * リアルタイム更新はしない。開いたときと手動更新でだけ取り直す。
 */
export const dashboardApi = {
  /**
   * GET /api/dashboard → 集計一式
   * `{ kpi, selectionBreakdown, slaByAssignee, slaTrend,
   *    complianceBreakdown, complianceIgnored, escalations, thresholds }`
   */
  get: () => http.get("/dashboard"),
}

export default dashboardApi
