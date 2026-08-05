import { http } from "./client.js"

/**
 * 定型文エンドポイント（api.md §2「メモ・定型文・サマリー」/ P2-1・P2-2）
 *
 * snippet の形: { id, command, title, body }
 * `body` には `{{studentName}}` のような変数プレースホルダが含まれる。
 * 展開はサーバの snippetRenderer が担当し、未設定の変数は `【未設定：面接日時】` で返る。
 */
export const snippetsApi = {
  /** GET /api/snippets → `{ snippets: snippet[] }` */
  list: () => http.get("/snippets"),
}

export default snippetsApi
