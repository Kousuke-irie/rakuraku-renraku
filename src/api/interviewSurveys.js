import { http } from "./client.js"

/**
 * 面接アンケートの人事向け参照（S-11）
 *
 * **閲覧は人事全員（hr / admin）。** 学生ロールでは 403 が返る。
 *
 * ★このAPIは回答者を返さない。「合否には影響しません」と約束して集めた回答なので、
 *   誰が書いたかを人事が辿れる経路を作らない（server/services/interviewSurveys.js）。
 * ★スコープの絞り込みを画面側でやらないこと。回答が少ない面接官の自由記述は
 *   サーバが落とす仕組みになっており、全件を受け取って絞ると匿名性が破れる。
 */
export const interviewSurveysApi = {
  /**
   * GET /api/interview-surveys → 面接官別の★集計
   * `{ interviewers, overall, suppressed, minSampleSize, answerableCount }`
   */
  get: () => http.get("/interview-surveys"),

  /**
   * GET /api/interview-surveys/comments → 匿名化した自由記述
   * `{ scopeId, isSuppressed, comments }`
   * @param {string} interviewerId 'all' / 面接官ID / 'unknown'
   */
  comments: (interviewerId) =>
    http.get("/interview-surveys/comments", { params: { interviewerId } }),

  /**
   * GET /api/interview-surveys/ai-summary → 自由記述のAI要約
   * `{ status, overview, positives, concerns, generatedAt, error }`
   */
  aiSummary: (interviewerId, { force = false } = {}) =>
    http.get("/interview-surveys/ai-summary", {
      params: force ? { interviewerId, force: "1" } : { interviewerId },
    }),
}

export default interviewSurveysApi
