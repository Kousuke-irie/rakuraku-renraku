import { defineStore } from 'pinia'
import {
  MESSAGE_PAGE_SIZE,
  MESSAGE_TYPE,
  SEND_ACK_TIMEOUT_MS,
  SEND_STATUS,
  SOCKET_EMIT,
} from '../constants/index.js'
import { messagesApi, toErrorMessage } from '../api/index.js'
import { emitSocket } from '../composables/useSocket.js'
import { useAuthStore } from './auth.js'

/**
 * メッセージストア（P0/A-1・B-2・B-3・frontend.md §3）
 *
 * message の形（GET /api/rooms/:id/messages の要素 / message:new のペイロード）:
 * {
 *   id: number,
 *   roomId: number,
 *   senderId: number,
 *   type: MESSAGE_TYPE,          // 'text' | 'system'
 *   body: string,
 *   topicTag: TOPIC_TAG|null,    // 学生の発言のみ。サーバが自動判定
 *   clientMsgId: string|null,    // 楽観描画の突き合わせキー（UUID）
 *   createdAt: string,           // ISO8601(UTC)
 *   deletedAt: string|null,      // 非 null は「送信を取り消しました」表示
 *
 *   // ↓ クライアントだけが持つフィールド
 *   sendStatus: SEND_STATUS,     // 'sending' | 'sent' | 'read' | 'failed'
 * }
 *
 * ルール:
 * - byRoomId[roomId] は **古い→新しい昇順**で保持する（REST は降順で返るので反転する）
 * - ルーム再訪時に再フェッチしない。キャッシュがあればそれを表示する（frontend.md §3）
 * - socket 由来の更新は必ずこのストアの action を通す
 */
/**
 * 昇順（古い→新しい）を保ったまま統合する。id 未確定（楽観描画中）のものは常に末尾。
 * @param {object[]} current
 * @param {object[]} incoming
 * @returns {object[]}
 */
function mergeAscending(current, incoming) {
  const known = new Set(current.map((message) => message.id).filter((id) => id !== null))
  const fresh = incoming.filter((message) => !known.has(message.id))

  const confirmed = [...current.filter((message) => message.id !== null), ...fresh].sort(
    (a, b) => a.id - b.id,
  )
  const pending = current.filter((message) => message.id === null)

  return [...confirmed, ...pending]
}

/** ack 待ちタイマーを解除する（送信確定・失敗確定・リセット時） */
function clearAckTimer(ackTimers, clientMsgId) {
  if (!ackTimers[clientMsgId]) return
  clearTimeout(ackTimers[clientMsgId])
  delete ackTimers[clientMsgId]
}

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    /** @type {Object<number, object[]>} ルームIDごとのメッセージ配列（昇順） */
    byRoomId: {},

    /** @type {Object<number, boolean>} ルームIDごとに、さらに過去ログがあるか */
    hasMore: {},

    /** @type {Object<number, boolean>} ルームIDごとの履歴取得中フラグ（無限スクロールの多重発火防止） */
    loadingByRoomId: {},

    /**
     * @type {Object<number, {[userId: number]: number}>}
     * ルームIDごとの既読位置。userId → lastReadMessageId（read:updated で更新）
     */
    readStateByRoomId: {},

    /** @type {Object<string, number>} clientMsgId → 送信失敗判定用のタイマーID */
    ackTimers: {},

    /** @type {Object<number, string>} ルームIDごとの入力欄の下書き（ルーム切替で失わない） */
    draftByRoomId: {},

    /** @type {string|null} */
    error: null,
  }),

  getters: {
    /** @returns {(roomId: number) => object[]} 表示用（昇順）。未取得なら空配列 */
    messagesOf: (s) => (roomId) => s.byRoomId[roomId] ?? [],

    /** @returns {(roomId: number) => object|undefined} 最古のメッセージ。before カーソルに使う */
    oldestOf: (s) => (roomId) => (s.byRoomId[roomId] ?? [])[0],

    /** @returns {(roomId: number) => boolean} */
    isLoading: (s) => (roomId) => s.loadingByRoomId[roomId] === true,

    /** @returns {(roomId: number) => boolean} 履歴を一度でも取得したか（再フェッチ判定） */
    isLoaded: (s) => (roomId) => Array.isArray(s.byRoomId[roomId]),

    /** @returns {(roomId: number) => boolean} 送信失敗のメッセージが残っているか */
    hasFailed: (s) => (roomId) =>
      (s.byRoomId[roomId] ?? []).some((message) => message.sendStatus === SEND_STATUS.FAILED),

    /**
     * 自分以外のメンバーが読み終えた最終メッセージID（B-3 の既読表示）。
     * 自分の吹き出しは `message.id <= ここの値` で「既読」になる。
     * @returns {(roomId: number, myUserId: number) => number} 既読情報が無ければ 0
     */
    lastReadByOthers: (s) => (roomId, myUserId) =>
      Object.entries(s.readStateByRoomId[roomId] ?? {}).reduce(
        (latest, [userId, lastReadMessageId]) =>
          Number(userId) === Number(myUserId) ? latest : Math.max(latest, lastReadMessageId ?? 0),
        0,
      ),
  },

  actions: {
    /**
     * GET /api/rooms/:id/messages?before=&limit=50
     * 降順で返るので昇順に反転して byRoomId に prepend する。
     * 取得件数 < limit なら hasMore[roomId] = false。
     * @param {number} roomId
     * @param {{ before?: number, limit?: number }} [options]
     */
    async loadHistory(roomId, options = {}) {
      const { before = null, limit = MESSAGE_PAGE_SIZE } = options
      if (this.loadingByRoomId[roomId]) return

      this.loadingByRoomId[roomId] = true
      this.error = null
      try {
        const { data } = await messagesApi.list(roomId, before ? { before, limit } : { limit })
        // レスポンスは降順。表示は昇順なので反転する
        const page = [...(data.messages ?? [])].reverse()

        const current = this.byRoomId[roomId] ?? []
        this.byRoomId[roomId] = before ? [...page, ...current] : mergeAscending(current, page)
        this.hasMore[roomId] = (data.messages ?? []).length >= limit
      } catch (error) {
        this.error = toErrorMessage(error, 'メッセージの取得に失敗しました')
      } finally {
        this.loadingByRoomId[roomId] = false
      }
    },

    /**
     * ルームを開いたときの初回ロード。キャッシュ済みなら何もしない（A-5 受入条件）。
     */
    async ensureLoaded(roomId) {
      if (this.isLoaded(roomId) || this.loadingByRoomId[roomId]) return
      await this.loadHistory(roomId)
    },

    /**
     * socket `message:send` で送信する（B-3）。
     * 1. clientMsgId(UUID) を生成し sendStatus='sending' で楽観的に追加
     * 2. SEND_ACK_TIMEOUT_MS 以内に message:sent が来なければ markFailed()
     * 3. 切断中は REST（POST /api/rooms/:id/messages）にフォールバック
     * @param {number} roomId
     * @param {string} body
     * @param {string[]|null} [acknowledgedCodes] 送信前チェック（P4-3）で人事が
     *   「このまま送信」を選んだルールコード。未指定ならチェック未経由として記録される。
     */
    async sendMessage(roomId, body, acknowledgedCodes = null) {
      const trimmed = body.trim()
      if (!trimmed) return

      const clientMsgId = crypto.randomUUID()
      const optimistic = {
        id: null,
        roomId: Number(roomId),
        senderId: useAuthStore().currentUserId,
        type: MESSAGE_TYPE.TEXT,
        body: trimmed,
        topicTag: null,
        clientMsgId,
        createdAt: new Date().toISOString(),
        deletedAt: null,
        sendStatus: SEND_STATUS.SENDING,
        // 再送（retryMessage）でも同じ注記が残るよう、楽観メッセージに載せて持ち回す。
        // 吹き出しの描画には使わない（sendStatus と違い表示要素ではない）。
        acknowledgedCodes,
      }

      this.byRoomId[roomId] = [...(this.byRoomId[roomId] ?? []), optimistic]
      this.draftByRoomId[roomId] = ''

      await this.deliver(roomId, optimistic)
    },

    /**
     * 楽観描画済みメッセージを実際に送る。socket が使えなければ REST に落とす。
     * sendMessage / retryMessage の共通処理（同じ clientMsgId を使うので二重保存されない）。
     */
    async deliver(roomId, message) {
      const { clientMsgId, body, acknowledgedCodes = null } = message

      if (emitSocket(SOCKET_EMIT.MESSAGE_SEND, { roomId, body, clientMsgId, acknowledgedCodes })) {
        // ack（message:sent）が来なければ失敗扱いにする
        this.ackTimers[clientMsgId] = setTimeout(
          () => this.markFailed(clientMsgId),
          SEND_ACK_TIMEOUT_MS,
        )
        return
      }

      // 切断中は REST フォールバック（api.md §1 責務分担）
      try {
        const { data } = await messagesApi.create(roomId, { body, clientMsgId, acknowledgedCodes })
        this.markSent(clientMsgId, data.message)
      } catch (error) {
        this.error = toErrorMessage(error, 'メッセージの送信に失敗しました')
        this.markFailed(clientMsgId)
      }
    },

    /**
     * 失敗したメッセージを再送する。**同じ clientMsgId を使う**ので二重保存されない。
     * @param {string} clientMsgId
     */
    async retryMessage(clientMsgId) {
      for (const [roomId, messages] of Object.entries(this.byRoomId)) {
        const target = messages.find((message) => message.clientMsgId === clientMsgId)
        if (!target) continue

        target.sendStatus = SEND_STATUS.SENDING
        await this.deliver(Number(roomId), target)
        return
      }
    },

    /**
     * 受信・送信済みメッセージを末尾に追加する（message:new の入口）。
     * clientMsgId が一致する楽観描画済みメッセージがあれば置き換える（自分の発言のエコー対策）。
     * id 重複時は何もしない（再接続時の差分取得と重複するため）。
     * @param {object} message
     */
    appendMessage(message) {
      const roomId = message?.roomId
      if (!roomId) return

      const current = this.byRoomId[roomId] ?? []

      // 自分の発言のエコー：楽観描画済みのものを置き換える
      const optimisticIndex = message.clientMsgId
        ? current.findIndex((existing) => existing.clientMsgId === message.clientMsgId)
        : -1
      if (optimisticIndex !== -1) {
        this.markSent(message.clientMsgId, message)
        return
      }

      // 再接続時の差分取得と重複するので id 重複は無視する
      if (current.some((existing) => existing.id === message.id)) return

      this.byRoomId[roomId] = mergeAscending(current, [{ ...message, sendStatus: SEND_STATUS.SENT }])
    },

    /**
     * ack（message:sent）を受けて楽観描画を確定する。
     * clientMsgId で仮メッセージを探し、サーバの message で置き換えて sendStatus='sent'。
     * @param {string} clientMsgId
     * @param {object} message
     */
    markSent(clientMsgId, message) {
      clearAckTimer(this.ackTimers, clientMsgId)

      const roomId = message?.roomId
      if (!roomId) return

      const current = this.byRoomId[roomId] ?? []
      const index = current.findIndex((existing) => existing.clientMsgId === clientMsgId)
      const confirmed = { ...message, sendStatus: SEND_STATUS.SENT }

      if (index === -1) {
        this.byRoomId[roomId] = mergeAscending(current, [confirmed])
        return
      }
      current[index] = confirmed
    },

    /**
     * ack タイムアウト／送信エラー時に sendStatus='failed' にする（再送ボタンを出す）。
     * @param {string} clientMsgId
     */
    markFailed(clientMsgId) {
      clearAckTimer(this.ackTimers, clientMsgId)

      for (const messages of Object.values(this.byRoomId)) {
        const target = messages.find((message) => message.clientMsgId === clientMsgId)
        if (!target) continue
        // すでに確定しているものは失敗に落とさない（ack と時間切れの競合対策）
        if (target.sendStatus === SEND_STATUS.SENDING) target.sendStatus = SEND_STATUS.FAILED
        return
      }
    },

    /**
     * 既読位置を更新する（read:updated）。
     * 相手の lastReadMessageId 以下の自分のメッセージは sendStatus='read' 相当で表示する。
     * @param {{ roomId: number, userId: number, lastReadMessageId: number }} payload
     */
    updateReadState({ roomId, userId, lastReadMessageId }) {
      if (!roomId || !userId || !lastReadMessageId) return

      const current = this.readStateByRoomId[roomId] ?? {}
      // 既読位置は巻き戻さない（複数タブ・再接続で古い値が後から届くことがある）
      if ((current[userId] ?? 0) >= lastReadMessageId) return

      this.readStateByRoomId[roomId] = { ...current, [userId]: lastReadMessageId }
    },

    /**
     * 自分がルームを開いた／新着を見たときに socket `message:read` を送る（P2-7）。
     * rooms ストアの unreadCount リセットは roomsStore.markRead() が担当する。
     */
    async sendRead(roomId, lastReadMessageId) {
      if (!roomId || !lastReadMessageId) return

      // 自分の既読位置は read:updated を待たずに反映する（相手の既読判定からは除外される）
      this.updateReadState({ roomId, userId: useAuthStore().currentUserId, lastReadMessageId })
      emitSocket(SOCKET_EMIT.MESSAGE_READ, { roomId, lastReadMessageId })
    },

    /**
     * 送信取消（B-3。24h以内・自分のみ）。DELETE /api/messages/:id
     * 表示の確定は message:deleted → markDeleted() で行い、他メンバーと同じ経路を通す。
     */
    async deleteMessage(messageId) {
      if (!messageId) return

      this.error = null
      try {
        await messagesApi.remove(messageId)
      } catch (error) {
        this.error = toErrorMessage(error, 'メッセージの取消に失敗しました')
      }
    },

    /**
     * 取消を反映する（message:deleted）。物理削除せず deletedAt を立てる。
     * @param {{ roomId: number, messageId: number }} payload
     */
    markDeleted({ roomId, messageId }) {
      const target = (this.byRoomId[roomId] ?? []).find((message) => message.id === messageId)
      if (!target) return

      target.deletedAt = new Date().toISOString()
      // 取消後の本文は誰にも見せない（画面にも残さない）
      target.body = ''
    },

    /** 入力欄の下書き保存 */
    setDraft(roomId, body) {
      this.draftByRoomId[roomId] = body
    },

    /**
     * 再接続時の欠落補完（api.md §4-4）。
     * ルームの最新メッセージIDより後を REST で取り直して appendMessage する。
     */
    async resync(roomId) {
      // NOTE: サーバの GET /rooms/:id/messages は `after` を持たないため、
      // 最新ページを取り直して appendMessage で重複排除する。
      try {
        const { data } = await messagesApi.list(roomId, { limit: MESSAGE_PAGE_SIZE })
        for (const message of [...(data.messages ?? [])].reverse()) this.appendMessage(message)
      } catch (error) {
        this.error = toErrorMessage(error, 'メッセージの再取得に失敗しました')
      }
    },

    /** 指定ルームのキャッシュを破棄する */
    clearRoom(roomId) {
      delete this.byRoomId[roomId]
      delete this.hasMore[roomId]
      delete this.loadingByRoomId[roomId]
      delete this.readStateByRoomId[roomId]
    },

    reset() {
      for (const clientMsgId of Object.keys(this.ackTimers)) {
        clearAckTimer(this.ackTimers, clientMsgId)
      }
      this.byRoomId = {}
      this.hasMore = {}
      this.loadingByRoomId = {}
      this.readStateByRoomId = {}
      this.draftByRoomId = {}
      this.error = null
    },
  },
})
