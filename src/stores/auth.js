import { defineStore } from 'pinia'
import { ROLE } from '../constants/index.js'
import { authApi, toErrorMessage, usersApi } from '../api/index.js'
import { connectSocket, disconnectSocket } from '../composables/useSocket.js'
import { useRoomsStore } from './rooms.js'
import { useMessagesStore } from './messages.js'
import { useUiStore } from './ui.js'

/**
 * 認証ストア（P0/A-3・frontend.md §3）
 *
 * 認証情報は httpOnly Cookie の JWT のみで保持する。
 * localStorage / sessionStorage にトークンやユーザー情報を保存しないこと（frontend.md §10-5）。
 *
 * user の形（GET /api/auth/me のレスポンス）:
 * {
 *   id: number,
 *   loginId: string,
 *   displayName: string,
 *   role: ROLE,            // 'hr' | 'student' | 'admin'
 *   avatarColor: string,   // '#7C9CBF'
 *   statusMessage: string | null,
 * }
 */

/**
 * @type {Promise<void>|null}
 * fetchMe の多重実行防止。ルーターガードと画面から同時に呼ばれても
 * /auth/me へのリクエストは1本にまとめる。
 */
let mePromise = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    /** @type {object|null} ログイン中のユーザー。未ログインは null */
    user: null,
    /** 起動後に一度でも /auth/me を解決したか。ルーターガードの待機判定に使う */
    initialized: false,
    /** 認証APIの通信中フラグ（ログインボタンの二重押下防止） */
    loading: false,
    /** @type {string|null} 直近の認証エラーメッセージ */
    error: null,
  }),

  getters: {
    isAuthenticated: (s) => s.user !== null,
    isHr: (s) => s.user?.role === ROLE.HR || s.user?.role === ROLE.ADMIN,
    isStudent: (s) => s.user?.role === ROLE.STUDENT,
    currentUserId: (s) => s.user?.id ?? null,
    /**
     * ログイン後の遷移先（frontend.md §1）。student は /chat、人事は S-07 ホーム。
     * LoginView・ルーターガード・ナビレールはすべてここを見る。パスを直書きしないこと。
     */
    homePath: (s) => (s.user?.role === ROLE.STUDENT ? '/chat' : '/home'),
  },

  actions: {
    /**
     * GET /api/auth/me でセッションを復元する。
     * 401 の場合も user = null / initialized = true にして正常終了させる
     * （リロード時にルーターガードが永久に待たないようにするため）。
     */
    async fetchMe() {
      if (mePromise) return mePromise

      mePromise = (async () => {
        try {
          const { data } = await authApi.me()
          this.user = data.user ?? null
          // リロード時もここが唯一の復元経路なので、socket 接続もここで張る
          if (this.user) connectSocket()
        } catch {
          // 401（未ログイン）もサーバ未起動も同じ「未認証」として扱う。
          // ここで throw するとガードが解決できず画面が固まる。
          this.user = null
        } finally {
          this.initialized = true
          mePromise = null
        }
      })()

      return mePromise
    },

    /**
     * POST /api/auth/login
     * @param {{ loginId: string, password: string }} credentials
     * @returns {Promise<boolean>} ログインに成功したか
     */
    async login(credentials) {
      this.loading = true
      this.error = null
      try {
        const { data } = await authApi.login(credentials)
        this.user = data.user ?? null
        this.initialized = true
        // Cookie が発行された直後に接続する（ハンドシェイクで JWT を検証させる）
        if (this.user) connectSocket()
        return this.user !== null
      } catch (error) {
        this.user = null
        this.error = toErrorMessage(error, 'ログインIDまたはパスワードが正しくありません')
        return false
      } finally {
        this.loading = false
      }
    },

    /**
     * POST /api/auth/register
     * @param {{ loginId: string, password: string, displayName: string, role: string }} payload
     * @returns {Promise<boolean>} 登録に成功したか
     */
    async register(payload) {
      this.loading = true
      this.error = null
      try {
        const { data } = await authApi.register(payload)
        this.user = data.user ?? null
        this.initialized = true
        if (this.user) connectSocket()
        return this.user !== null
      } catch (error) {
        this.user = null
        this.error = toErrorMessage(error, '登録に失敗しました')
        return false
      } finally {
        this.loading = false
      }
    },

    /**
     * POST /api/auth/logout → 全ストアをリセットし socket を切断する。
     */
    async logout() {
      this.loading = true
      try {
        await authApi.logout()
      } catch {
        // サーバ側で失敗してもクライアントの状態は必ず破棄する
      } finally {
        this.loading = false
        disconnectSocket()
        useRoomsStore().reset()
        useMessagesStore().reset()
        useUiStore().reset()
        this.reset()
      }
    },

    /**
     * PUT /api/users/me（B-5：表示名・ステータスメッセージ・avatarColor）
     * @param {{ displayName?: string, statusMessage?: string, avatarColor?: string }} patch
     * @returns {Promise<boolean>} 更新に成功したか
     */
    async updateProfile(patch) {
      this.loading = true
      this.error = null
      try {
        const { data } = await usersApi.updateMe(patch)
        this.user = data.user ?? { ...this.user, ...patch }
        return true
      } catch (error) {
        this.error = toErrorMessage(error, 'プロフィールの更新に失敗しました')
        return false
      } finally {
        this.loading = false
      }
    },

    /** ストアを初期状態へ戻す（logout / 401 検知時） */
    reset() {
      mePromise = null
      // REST の 401 検知（api/client.js）からも呼ばれる。
      // 認証が切れた socket を張ったままにしない。
      disconnectSocket()
      this.user = null
      // セッションが無いことは確定しているので initialized は true のまま保つ。
      // false に戻すと次のガードで /auth/me を無駄に叩く。
      this.initialized = true
      this.loading = false
      this.error = null
    },
  },
})
