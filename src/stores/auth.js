/* eslint-disable no-unused-vars -- 空実装のため引数が未使用。実装時にこの行を消すこと */
import { defineStore } from 'pinia'
import { ROLE } from '../constants/index.js'

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
    /** ログイン後の遷移先。student は /chat、それ以外は /inbox */
    homePath: (s) => (s.user?.role === ROLE.STUDENT ? '/chat' : '/inbox'),
  },

  actions: {
    /**
     * GET /api/auth/me でセッションを復元する。
     * 401 の場合も user = null / initialized = true にして正常終了させる
     * （リロード時にルーターガードが永久に待たないようにするため）。
     */
    async fetchMe() {},

    /**
     * POST /api/auth/login
     * @param {{ loginId: string, password: string }} credentials
     */
    async login(credentials) {},

    /**
     * POST /api/auth/register
     * @param {{ loginId: string, password: string, displayName: string, role: string }} payload
     */
    async register(payload) {},

    /**
     * POST /api/auth/logout → 全ストアをリセットし socket を切断する。
     */
    async logout() {},

    /**
     * PUT /api/users/me（B-5：表示名・ステータスメッセージ・avatarColor）
     * @param {{ displayName?: string, statusMessage?: string, avatarColor?: string }} patch
     */
    async updateProfile(patch) {},

    /** ストアを初期状態へ戻す（logout / 401 検知時） */
    reset() {},
  },
})
