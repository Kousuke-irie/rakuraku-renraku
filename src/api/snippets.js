import { http } from "./client.js"

/**
 * 定型文エンドポイント（api.md §2「メモ・定型文・サマリー」/ P2-1・P2-2）
 *
 * snippet の形: { id, command, title, body }
 * `body` には `{学生名}` のような変数プレースホルダを含められる（business-logic.md §5）。
 * 実データへの置換は P2-2 の責務。P2-1 時点ではプレースホルダのまま入力欄へ展開する。
 */
export const snippetsApi = {
  /** GET /api/snippets → `{ snippets: snippet[] }` */
  list: () => http.get("/snippets"),
  /** POST /api/snippets → `{ snippet }`（設定画面からの追加） */
  create: ({ command, title, body }) => http.post("/snippets", { command, title, body }),
  /** PATCH /api/snippets/:id → `{ snippet }`（部分更新） */
  update: (id, patch) => http.patch(`/snippets/${id}`, patch),
  /** DELETE /api/snippets/:id */
  remove: (id) => http.delete(`/snippets/${id}`),
}

export default snippetsApi
