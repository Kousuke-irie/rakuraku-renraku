import { http } from "./client.js"

/**
 * 人事FBアンケートの人事向け参照（S-12）
 *
 * **閲覧は人事全員（hr / admin）。** 学生ロールでは 403 が返る。
 *
 * ★このAPIは回答者を返さない。「特定されません」と約束して集めた回答なので、
 *   誰が書いたかを人事が辿れる経路を作らない（server/services/hrSurveys.js）。
 * ★スコープの絞り込みを画面側でやらないこと。回答が少ない担当者の自由記述は
 *   サーバが落とす仕組みになっており、全件を受け取って絞ると匿名性が破れる。
 *
 * ★★集計そのもの（担当者別の平均・回答率）は GET /api/dashboard に同梱されている。
 *   監視ダッシュボードは1往復で描く方針なので、画面はそちらを使い、このAPIの
 *   `get()` は単体で確認したいときのために残してある。
 */
export const hrSurveysApi = {
  /**
   * GET /api/hr-surveys → 担当者別の★集計
   * `{ assignees, overall, outcomes, suppressed, minSampleSize, answerableCount }`
   */
  get: () => http.get("/hr-surveys"),

  /**
   * GET /api/hr-surveys/comments → 匿名化した自由記述
   * `{ scopeId, isSuppressed, comments }`
   * @param {string} assigneeId 'all' / 担当者ID / 'unknown'
   */
  comments: (assigneeId) => http.get("/hr-surveys/comments", { params: { assigneeId } }),

  /**
   * GET /api/hr-surveys/ai-summary → 自由記述のAI要約
   * `{ status, overview, positives, concerns, generatedAt, error }`
   */
  aiSummary: (assigneeId, { force = false } = {}) =>
    http.get("/hr-surveys/ai-summary", {
      params: force ? { assigneeId, force: "1" } : { assigneeId },
    }),
}

export default hrSurveysApi
