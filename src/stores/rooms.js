/* eslint-disable no-unused-vars -- 空実装のため引数が未使用。実装時にこの行を消すこと */
import { defineStore } from 'pinia'
import {
  AI_SUMMARY_STATUS,
  DEFAULT_AI_SUMMARY_STATUS,
  DEFAULT_SORT_KEY,
  ROLE,
  SOCKET_EMIT,
} from '../constants/index.js'
import { memosApi, roomsApi, studentsApi, toErrorMessage, usersApi } from '../api/index.js'
import { emitSocketAck } from '../composables/useSocket.js'
import { useUiStore } from './ui.js'

/** 対応ステータス変更が失敗したときの既定文言（P1-2） */
const STATUS_UPDATE_ERROR = '対応ステータスの変更に失敗しました'

/** 申し送りメモ（P2-5）の失敗時の既定文言 */
const MEMO_ERROR = Object.freeze({
  FETCH: 'メモの取得に失敗しました',
  CREATE: 'メモの保存に失敗しました',
  UPDATE: 'メモの更新に失敗しました',
  DELETE: 'メモの削除に失敗しました',
})

/** 更新の新しい順。引き継ぎ時に最新の申し送りが上に来るようにする */
const byUpdatedAtDesc = (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))

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

    /**
     * ホームの AI 現況サマリー（P3-1a・business-logic.md §7-2）。
     * サーバ由来のデータなので ui ストアではなくここに置く。
     * ★中身の生成は P3-1a で実装する。現状は UI の受け皿だけ用意した状態。
     * @type {{
     *   status: string,               // AI_SUMMARY_STATUS のいずれか
     *   situation: string,            // 現状の1〜2文の要約
     *   todos: {roomId: number, studentName: string, action: string, reason: string}[],
     *   generatedAt: string|null,     // ISO8601(UTC)
     *   error: string|null,
     * }}
     */
    aiSummary: {
      status: DEFAULT_AI_SUMMARY_STATUS,
      situation: '',
      todos: [],
      generatedAt: null,
      error: null,
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

    /** @returns {(roomId: number) => object[]} 指定ルームのメモ（個人＋共有・更新の新しい順） */
    memosOf: (s) => (roomId) => [...(s.memosByRoomId[Number(roomId)] ?? [])].sort(byUpdatedAtDesc),
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

    /** GET /api/users?role=hr&role=admin（P2-9 担当者アサインの候補。人事のみ） */
    async fetchAssignableUsers() {
      try {
        const { data } = await usersApi.list({ role: [ROLE.HR, ROLE.ADMIN] })
        this.assignableUsers = data.users ?? []
      } catch (error) {
        useUiStore().pushToast({
          type: 'error',
          message: toErrorMessage(error, '担当者一覧の取得に失敗しました'),
        })
      }
    },

    // ---- AI 現況サマリー（P3-1a） -----------------------------------------

    /**
     * GET /api/ai/summary。ホーム表示時にキャッシュ済みの要約を取りに行く。
     * ★P3-1a で実装する。サーバ側（server/services/aiSummary.js）が未実装のため
     *   今は API を叩かず「準備中」を立てるだけにしてある。
     *   AI が落ちてもホームの一覧は動き続けること（business-logic.md §7-2）。
     */
    async fetchAiSummary() {
      this.setAiSummary({ status: AI_SUMMARY_STATUS.UNAVAILABLE })
    },

    /**
     * POST /api/ai/summary。右下の AI ボタン／カードの更新から呼ぶ強制再生成。
     * ★P3-1a で実装する。
     */
    async regenerateAiSummary() {
      this.setAiSummary({ status: AI_SUMMARY_STATUS.UNAVAILABLE })
    },

    /**
     * AI サマリーを差し替える。REST の応答も socket `ai:summary_updated` も必ずここを通す。
     * @param {{status?: string, situation?: string, todos?: object[], generatedAt?: string|null, error?: string|null}} summary
     */
    setAiSummary(summary) {
      this.aiSummary = { ...this.aiSummary, ...summary }
    },

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
     * メモを1件追加または差し替える。**socket 由来（memo:updated）も REST の応答もここを通す。**
     * @param {number} roomId
     * @param {object} memo
     */
    upsertMemo(roomId, memo) {
      if (!memo?.id) return

      const key = Number(roomId)
      const list = this.memosByRoomId[key] ?? []
      const index = list.findIndex((existing) => existing.id === memo.id)

      // 並べ替えは memosOf が行うので、ここでは順序を気にせず入れ替えるだけでよい
      this.memosByRoomId[key] = index === -1 ? [...list, memo] : list.with(index, memo)
    },

    /** メモを1件取り除く（削除の反映） */
    removeMemo(roomId, memoId) {
      const key = Number(roomId)
      const list = this.memosByRoomId[key]
      if (!list) return

      this.memosByRoomId[key] = list.filter((memo) => memo.id !== memoId)
    },

    /** GET /api/rooms/:id/memos。自分の個人メモ＋共有メモが返る */
    async fetchMemos(roomId) {
      try {
        const { data } = await memosApi.list(roomId)
        this.memosByRoomId[Number(roomId)] = data.memos ?? []
      } catch (error) {
        useUiStore().pushToast({ type: 'error', message: toErrorMessage(error, MEMO_ERROR.FETCH) })
      }
    },

    /**
     * POST /api/rooms/:id/memos
     * @returns {Promise<boolean>} 保存できたか（呼び出し側は成功時だけ入力欄を空にする）
     */
    async createMemo(roomId, { body, scope }) {
      try {
        const { data } = await memosApi.create(roomId, { body, scope })
        this.upsertMemo(roomId, data.memo)
        return true
      } catch (error) {
        useUiStore().pushToast({ type: 'error', message: toErrorMessage(error, MEMO_ERROR.CREATE) })
        return false
      }
    },

    /**
     * PATCH /api/memos/:id（本文更新・scope の共有昇格 P2-6）
     * @param {number} memoId
     * @param {{ body?: string, scope?: string }} patch
     * @returns {Promise<boolean>} 更新できたか
     */
    async updateMemo(memoId, patch) {
      try {
        const { data } = await memosApi.update(memoId, patch)
        this.upsertMemo(data.memo.roomId, data.memo)
        return true
      } catch (error) {
        useUiStore().pushToast({ type: 'error', message: toErrorMessage(error, MEMO_ERROR.UPDATE) })
        return false
      }
    },

    /** DELETE /api/memos/:id */
    async deleteMemo(roomId, memoId) {
      try {
        await memosApi.remove(memoId)
        this.removeMemo(roomId, memoId)
        return true
      } catch (error) {
        useUiStore().pushToast({ type: 'error', message: toErrorMessage(error, MEMO_ERROR.DELETE) })
        return false
      }
    },

    // ---- 更新系（人事の操作） ---------------------------------------------

    /**
     * 対応ステータスの変更（P1-2）。
     *
     * 一覧を離れず1クリックで色が変わることが受入条件なので、まず楽観更新する。
     * 送信は socket `room:status_update`（低遅延）、切断中は REST にフォールバックする。
     * 確定値はサーバの `room:updated`（＝他の人事の画面にも即座に反映される経路）で上書きされ、
     * 失敗したときだけ元のステータスへ戻してトーストを出す。
     *
     * @param {number} roomId
     * @param {string} handlingStatus HANDLING_STATUS のいずれか
     */
    async updateHandlingStatus(roomId, handlingStatus) {
      const room = this.roomById(roomId)
      if (!room || room.handlingStatus === handlingStatus) return

      const previous = room.handlingStatus
      this.upsertRoom({ id: room.id, handlingStatus })

      const rollback = (message) => {
        this.upsertRoom({ id: room.id, handlingStatus: previous })
        useUiStore().pushToast({ type: 'error', message })
      }

      const ack = await emitSocketAck(SOCKET_EMIT.ROOM_STATUS_UPDATE, {
        roomId: room.id,
        handlingStatus,
      })
      if (ack) {
        if (!ack.ok) rollback(ack.message ?? STATUS_UPDATE_ERROR)
        return
      }

      // 未接続時のフォールバック（api.md §1 責務分担）。レスポンスの room をそのまま反映する
      try {
        const { data } = await roomsApi.update(room.id, { handlingStatus })
        this.upsertRoom(data.room)
      } catch (error) {
        rollback(toErrorMessage(error, STATUS_UPDATE_ERROR))
      }
    },

    /**
     * PATCH /api/rooms/:id { assigneeUserId }（P2-9）。null で未割当に戻す。
     * 確定値は他の人事にも配信される `room:updated` で上書きされる。
     * @returns {Promise<boolean>} 変更できたか
     */
    async assign(roomId, assigneeUserId) {
      try {
        const { data } = await roomsApi.update(roomId, { assigneeUserId })
        this.upsertRoom(data.room)
        return true
      } catch (error) {
        useUiStore().pushToast({
          type: 'error',
          message: toErrorMessage(error, '担当人事の変更に失敗しました'),
        })
        return false
      }
    },

    /** PATCH /api/rooms/:id { isPinned }（P2-8） */
    async togglePin(roomId) {},

    /**
     * PATCH /api/students/:userId（P2-4 プロフィールのインライン編集 / P3-4 日程調整）
     * @param {number} userId 学生のユーザーID（ルームIDではない）
     * @param {object} patch selectionStatus / nextInterviewAt / nextInterviewRoom / interviewer / scheduleState
     * @returns {Promise<boolean>} 更新できたか
     */
    async updateStudent(userId, patch) {
      const room = this.rooms.find((item) => item.student?.userId === Number(userId))

      try {
        const { data } = await studentsApi.update(userId, patch)
        // student はサーバが完全な形で返すのでそのまま差し替えてよい
        if (room) this.upsertRoom({ id: room.id, student: data.student })
        return true
      } catch (error) {
        useUiStore().pushToast({
          type: 'error',
          message: toErrorMessage(error, 'プロフィールの更新に失敗しました'),
        })
        return false
      }
    },

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
      this.aiSummary = {
        status: DEFAULT_AI_SUMMARY_STATUS,
        situation: '',
        todos: [],
        generatedAt: null,
        error: null,
      }
      this.memosByRoomId = {}
      this.assignableUsers = []
      this.loading = false
      this.error = null
    },
  },
})
