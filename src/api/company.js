import { http } from "./client.js"

/** 会社情報エンドポイント（P2-10・api.md §2「会社情報」） */
export const companyApi = {
  /**
   * GET /api/company → `{ company: { name, description, recruitSiteUrl, updatedAt } | null }`
   * 学生のトーク画面の会社情報パネルにも出すので、参照は全ロール可。
   * 未設定のときは `company: null` が返る。
   */
  get: () => http.get("/company"),

  /**
   * PUT /api/company → `{ company }`（人事のみ）
   * 3項目すべてを送る全置換。省略ではなく空文字・null で「未設定」を表す。
   * @param {{ name: string, description?: string|null, recruitSiteUrl?: string|null }} input
   */
  update: (input) => http.put("/company", input),
}

export default companyApi
