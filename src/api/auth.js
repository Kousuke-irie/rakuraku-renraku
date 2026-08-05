import { http } from "./client.js"

/**
 * 認証エンドポイント（api.md §2「認証」）
 *
 * JWT は httpOnly Cookie でサーバが発行する。クライアントはトークンを一切保持しない。
 * user の形: { id, loginId, displayName, role, avatarColor, statusMessage }
 */
export const authApi = {
  /**
   * POST /api/auth/login → `{ user }` + Set-Cookie
   * @param {{ loginId: string, password: string }} credentials
   */
  login: (credentials) => http.post("/auth/login", credentials),

  /**
   * POST /api/auth/register → `{ user }` + Set-Cookie
   * @param {{ loginId: string, password: string, displayName: string, role: string }} payload
   *   role は ROLE（shared/constants.js）のいずれか
   */
  register: (payload) => http.post("/auth/register", payload),

  /** POST /api/auth/logout → 204 */
  logout: () => http.post("/auth/logout"),

  /** GET /api/auth/me → `{ user }`。未ログインは 401 */
  me: () => http.get("/auth/me"),
}

export default authApi
