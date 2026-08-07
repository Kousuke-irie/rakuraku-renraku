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
   * GET /api/selection-flow/me
   *   → `{ steps, selectionStatus, isDeclined }`（学生のみ）
   *
   * 学生のマイページ（S-09）用。ステップ・自分の現在位置・見せてよいFB を1回で受け取る。
   * ★FB は**完了済みステップのぶんだけ**サーバが返す。クライアントで隠す作りにしない。
   * 各ステップの `surveyAnswered` に面接アンケート（S-11）の回答済みフラグが入る。
   * `hrSurvey`（S-12）に人事FBアンケートの状態
   * `{ answerable, answered, outcome, outcomeLabel }` が入る。
   */
  me: () => http.get("/selection-flow/me"),

  /**
   * POST /api/selection-flow/me/surveys → `{ statusKey, answeredAt }`（学生のみ）
   *
   * 面接アンケートの回答（S-11）。回答できるのは完了済みの面接ステップだけで、
   * 判定はサーバが持つ。1ステップにつき1回で、あとから上書きはできない。
   */
  submitSurvey: (statusKey, rating, comment) =>
    http.post("/selection-flow/me/surveys", { statusKey, rating, comment }),

  /**
   * POST /api/selection-flow/me/hr-survey → `{ answeredAt }`（学生のみ）
   *
   * 人事FBアンケートの回答（S-12）。回答できるのは選考が終わった学生（内定・辞退）
   * だけで、判定はサーバが持つ。1人につき1回で、あとから上書きはできない。
   * @param {object} ratings HR_SURVEY_AXIS をキーにした★（3軸すべて必須）
   */
  submitHrSurvey: (ratings, comment) =>
    http.post("/selection-flow/me/hr-survey", { ratings, comment }),

  /**
   * GET /api/students/:userId/feedbacks
   *   → `{ steps, selectionStatus, isDeclined }`（人事のみ）
   *
   * 受信箱のプロフィールパネル用。本文は全ステップぶん返る（完了判定で絞らない）。
   * ★`isVisibleToStudent` は**サーバが返す**。学生側と同じ判定を通しているので、
   *   クライアントで計算し直さないこと（ズレると「非公開」の表示が嘘になる）。
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
