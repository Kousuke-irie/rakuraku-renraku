import { http } from "./client.js"

/** 選考フローエンドポイント（P2-11 / S-09・api.md §2「選考フロー」） */
export const selectionFlowApi = {
  /**
   * GET /api/selection-flow → `{ steps }`（無効なステップも含む全件）
   * 人事の設定画面用。
   */
  list: () => http.get("/selection-flow"),

  /**
   * PUT /api/selection-flow → `{ steps }`（人事のみ）
   * 全ステップを1回で送る全置換。部分更新は並び順が壊れるので受け付けない。
   * @param {object[]} steps
   */
  save: (steps) => http.put("/selection-flow", { steps }),

  /**
   * GET /api/selection-flow/me → `{ steps, selectionStatus, isDeclined }`（学生のみ）
   * 学生のマイページ（S-09）用。ステップ・自分の現在位置・見せてよいFB を1回で受け取る。
   * ★FB は**完了済みステップのぶんだけ**サーバが返す。クライアントで隠す作りにしない。
   */
  me: () => http.get("/selection-flow/me"),

  /**
   * GET /api/students/:userId/feedbacks → `{ feedbacks }`（人事のみ）
   * 受信箱のプロフィールパネル用。完了判定で絞らない全件。
   */
  listFeedbacks: (userId) => http.get(`/students/${userId}/feedbacks`),

  /**
   * PUT /api/students/:userId/feedbacks/:statusKey → `{ feedback }`（人事のみ）
   * 空文字を送ると取り消し（削除）になる。
   */
  saveFeedback: (userId, statusKey, body) =>
    http.put(`/students/${userId}/feedbacks/${statusKey}`, { body }),
}

export default selectionFlowApi
