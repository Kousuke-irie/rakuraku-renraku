import axios from "axios"

/**
 * REST APIクライアント（api.md §1）
 *
 * - ベースURL は `/api`。dev は Vite の proxy で localhost:3000 へ転送される
 * - 認証は httpOnly Cookie の JWT。`withCredentials: true` が必須
 * - トークンを localStorage / sessionStorage に保存しないこと（frontend.md §10-5）
 * - 日時はすべて ISO8601(UTC) 文字列。ローカル変換は表示時のみ（CLAUDE.md §6-2）
 */
export const http = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 10000,
  // 配列パラメータを `urgency=high&urgency=normal` 形式で送る。
  // 既定の `urgency[]=high` だと Express の req.query のキーが変わってしまう。
  paramsSerializer: { indexes: null },
})

/**
 * 認証系のパスかどうか。
 * `/auth/me` の 401 は「未ログイン」という正常系、`/auth/login` の 401 は
 * 「ID・パスワード違い」なので、どちらもセッション切れ扱いにしてはいけない。
 */
const isAuthPath = (url = "") => url.startsWith("/auth/")

// セッション切れ（401）の共通処理。ストア・ルーターは動的 import で読み込み、
// api → store → api の循環参照を避ける。
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isAuthPath(error.config?.url ?? "")) {
      const { useAuthStore } = await import("../stores/auth.js")
      const { default: router } = await import("../router/index.js")

      useAuthStore().reset()
      if (router.currentRoute.value.name !== "login") {
        router.replace({
          name: "login",
          query: { redirect: router.currentRoute.value.fullPath },
        })
      }
    }
    return Promise.reject(error)
  },
)

/**
 * サーバのエラー形式 `{ error, message }` から表示用メッセージを取り出す。
 * @param {unknown} error
 * @param {string} fallback
 * @returns {string}
 */
export function toErrorMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default http
