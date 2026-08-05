import { http } from "./client.js"

/**
 * 学生プロフィールエンドポイント（api.md §2「学生・ユーザー」）
 *
 * student の形:
 * { userId, displayName, university, faculty, selectionStatus, avatarColor,
 *   nextInterviewAt, nextInterviewRoom, interviewer, scheduleState }
 *
 * 日時は ISO8601(UTC) 文字列で送る（CLAUDE.md §6-2）。
 */
export const studentsApi = {
  /**
   * GET /api/students/:userId → `{ student }`
   * @param {number} userId 学生のユーザーID（ルームIDではない）
   */
  get: (userId) => http.get(`/students/${userId}`),

  /**
   * PATCH /api/students/:userId → `{ student }`
   * P2-4（プロフィールのインライン編集）と P3-4（日程調整トラッカー）の両方で使う。
   * @param {number} userId
   * @param {{
   *   selectionStatus?: string, nextInterviewAt?: string|null,
   *   nextInterviewRoom?: string|null, interviewer?: string|null,
   *   scheduleState?: string
   * }} patch 列挙値は shared/constants.js のものを渡す
   */
  update: (userId, patch) => http.patch(`/students/${userId}`, patch),
}

export default studentsApi
