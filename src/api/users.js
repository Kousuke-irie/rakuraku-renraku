import { http } from "./client.js"

/** ユーザーエンドポイント（api.md §2「学生・ユーザー」） */
export const usersApi = {
  /**
   * PUT /api/users/me → `{ user }`（B-5：自分の表示名・ステータスメッセージ更新）
   * @param {{ displayName?: string, statusMessage?: string, avatarColor?: string }} patch
   */
  updateMe: (patch) => http.put("/users/me", patch),

  /**
   * GET /api/users?role=hr → `{ users: { id, displayName, avatarColor }[] }`
   * 担当者アサイン（P2-9）の候補一覧。
   * @param {{ role?: string }} [params] role は ROLE（shared/constants.js）のいずれか
   */
  list: (params) => http.get("/users", { params }),
}

export default usersApi
