/* eslint-disable no-unused-vars -- 空実装のため引数が未使用。実装時にこの行を消すこと */
import { defineStore } from 'pinia'
import { DEFAULT_SORT_KEY } from '../constants/index.js'
import { roomsApi, toErrorMessage } from '../api/index.js'

/**
 * 受信箱ストア（P1-1 / P1-7 / P1-8・frontend.md §3）
 *
 * room の形（GET /api/rooms のレスポンス要素・api.md §2）:
 * {
 *   id: number,
 *   student: {
 *     userId: number, displayName: string, university: string,
 *     selectionStatus: SELECTION_STATUS, avatarColor: string,
 *     nextInterviewAt: string|null,      // ISO8601(UTC)
 *     nextInterviewRoom: string|null,
 *     interviewer: string|null,
 *     scheduleState: SCHEDULE_STATE,     // P3-4
 *   },
 *   handlingStatus: HANDLING_STATUS,
 *   urgency: URGENCY,
 *   topicTag: TOPIC_TAG,
 *   isPinned: boolean,
 *   assignee: { id: number, displayName: string } | null,   // null = 未割当
 *   unreadCount: number,
 *   lastMessage: { id, body, createdAt, senderId } | null,
 *   lastStudentMessageAt: string|null,   // ISO8601(UTC)。経過時間の基準
 *   elapsedHours: number,                // サーバ算出。表示は useElapsedTime で1分ごとに再計算
 * }
 *
 * ルール:
 * - フィルタ・ソート条件はこのストアに保持する。ルーム切替で失われないこと（frontend.md §3）
 * - 絞り込みと並べ替えはクライアント側の getter で行う（socket 更新を即座に反映するため）。
 *   検索文字列 q だけはサーバに投げ直してもよい
 */
export const useRoomsStore = defineStore('rooms', {
  state: () => ({
    /** @type {object[]} 全ルーム。順序は保持しない（並べ替えは sortedRooms が行う） */
    rooms: [],

    /** フィルタ条件（P1-7）。null / 空配列 = 絞り込みなし */
    filters: {
      /** @type {string[]} HANDLING_STATUS の配列 */
      handlingStatus: [],
      /** @type {string[]} SELECTION_STATUS の配列 */
      selectionStatus: [],
      /** @type {string[]} TOPIC_TAG の配列 */
      topicTag: [],
      /** @type {string[]} URGENCY の配列 */
      urgency: [],
      /** @type {number|null} 担当者ユーザーID。'unassigned' で未割当のみ */
      assigneeId: null,
      /** 「自分の担当のみ」トグル */
      onlyMine: false,
      /** 24h超のみ（サマリーバーからの絞り込み用） */
      overdueOnly: false,
      /** 氏名・大学の部分一致検索 */
      q: '',
    },

    /** @type {string} SORT_KEY のいずれか */
    sortKey: DEFAULT_SORT_KEY,

    /** 未対応サマリー（P1-8・GET /api/summary / summary:updated） */
    summary: {
      needsReply: 0,
      urgent: 0,
      overdue24h: 0,
      unassigned: 0,
    },

    /** @type {Object<number, object[]>} ルームIDごとのメモ一覧（P2-5。個人＋共有） */
    memosByRoomId: {},

    /** @type {object[]} 担当者アサイン候補（GET /api/users?role=hr） */
    assignableUsers: [],

    loading: false,
    /** @type {string|null} */
    error: null,
  }),

  getters: {
    /** @returns {(roomId: number) => object|undefined} */
    roomById: (s) => (roomId) => s.rooms.find((room) => room.id === Number(roomId)),

    /**
     * filters を適用した結果（並べ替え前）。
     * まず選考ステータスのみ実装（P1-7）。他条件は次のステップ以降で追加する。
     */
    filteredRooms: (s) => {
      const { selectionStatus } = s.filters
      return s.rooms.filter((room) => {
        if (selectionStatus.length && !selectionStatus.includes(room.student?.selectionStatus)) {
          return false
        }
        return true
      })
    },

    /**
     * 表示用の最終リスト。
     * SORT_KEY.DEFAULT: is_pinned DESC → urgency（high→normal→low）→ lastStudentMessageAt ASC
     * SORT_KEY.LAST_MESSAGE: lastMessage.createdAt DESC
     * SORT_KEY.ELAPSED: lastStudentMessageAt ASC（経過時間が長い順）
     * （business-logic.md §6）
     */
    sortedRooms: (s) => [],

    /** フィルタが1つでも掛かっているか（「条件をクリア」ボタンの活性判定） */
    hasActiveFilters: (s) => false,

    /** 全ルームの未読合計 */
    totalUnread: (s) => 0,

    /** @returns {(roomId: number) => object[]} 指定ルームのメモ */
    memosOf: (s) => (roomId) => [],
  },

  actions: {
    // ---- 取得系（REST） ---------------------------------------------------

    /** GET /api/rooms。初回ロード時と socket 再接続時に呼ぶ */
    async fetchRooms() {
      this.loading = true
      this.error = null
      try {
        const { data } = await roomsApi.list()
        this.rooms = data.rooms ?? []
      } catch (error) {
        this.error = toErrorMessage(error, 'ルーム一覧の取得に失敗しました')
      } finally {
        this.loading = false
      }
    },

    /** GET /api/rooms/:id（学生プロフィール込み）→ upsertRoom */
    async fetchRoom(roomId) {},

    /** GET /api/summary（P1-8） */
    async fetchSummary() {},

    /** GET /api/users?role=hr（P2-9 担当者アサイン用） */
    async fetchAssignableUsers() {},

    // ---- 反映系（socket / REST 共通の入口） --------------------------------

    /**
     * ルームを1件追加または差し替える。**socket 由来の更新は必ずここを通す。**
     * 既存があれば浅くマージし、無ければ追加する。
     * @param {object} room
     */
    upsertRoom(room) {
      if (!room?.id) return

      const index = this.rooms.findIndex((existing) => existing.id === room.id)
      if (index === -1) {
        this.rooms.push(room)
        return
      }
      // socket の message:new は { id } だけのこともあるので浅くマージする
      // （既存の student / assignee などを消さない）。
      this.rooms[index] = { ...this.rooms[index], ...room }
    },

    /**
     * サマリーを差し替える（summary:updated）。
     * @param {{ needsReply: number, urgent: number, overdue24h: number, unassigned?: number }} summary
     */
    setSummary(summary) {},

    /**
     * 共有メモの追加・更新を反映する（memo:updated / P2-5）。
     * @param {number} roomId
     * @param {object} memo
     */
    upsertMemo(roomId, memo) {},

    /** GET /api/rooms/:id/memos */
    async fetchMemos(roomId) {},

    /** POST /api/rooms/:id/memos */
    async createMemo(roomId, { body, scope }) {},

    /** PATCH /api/memos/:id（本文更新・scope 昇格 P2-6） */
    async updateMemo(memoId, patch) {},

    /** DELETE /api/memos/:id */
    async deleteMemo(memoId) {},

    // ---- 更新系（人事の操作） ---------------------------------------------

    /**
     * 対応ステータスの変更（P1-2）。socket `room:status_update` で送り、
     * 応答の room:updated で確定する。楽観更新してよいが失敗時は戻すこと。
     */
    async updateHandlingStatus(roomId, handlingStatus) {},

    /** PATCH /api/rooms/:id { assigneeUserId }（P2-9） */
    async assign(roomId, assigneeUserId) {},

    /** PATCH /api/rooms/:id { isPinned }（P2-8） */
    async togglePin(roomId) {},

    /** PATCH /api/students/:userId（P2-4 プロフィールのインライン編集 / P3-4 日程調整） */
    async updateStudent(userId, patch) {},

    /** POST /api/rooms/:id/read → 該当ルームの unreadCount を 0 にする */
    async markRead(roomId, lastReadMessageId) {},

    // ---- フィルタ・ソート -------------------------------------------------

    /**
     * フィルタを部分更新する。サマリーバーのクリック（P1-8）からもここを呼ぶ。
     * 例：applyFilters({ handlingStatus: [HANDLING_STATUS.NEEDS_REPLY] })
     * @param {object} patch filters の部分オブジェクト
     */
    applyFilters(patch) {
      this.filters = { ...this.filters, ...patch }
    },

    /** フィルタを初期状態へ戻す（「条件をクリア」） */
    clearFilters() {},

    /** @param {string} sortKey SORT_KEY のいずれか */
    setSortKey(sortKey) {},

    /** 「自分の担当のみ」トグル */
    toggleOnlyMine() {},

    reset() {
      this.rooms = []
      this.summary = { needsReply: 0, urgent: 0, overdue24h: 0, unassigned: 0 }
      this.memosByRoomId = {}
      this.assignableUsers = []
      this.loading = false
      this.error = null
    },
  },
})
