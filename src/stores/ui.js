/* eslint-disable no-unused-vars -- 空実装のため引数が未使用。実装時にこの行を消すこと */
import { defineStore } from 'pinia'
import { MEMO_SCOPE } from '../constants/index.js'

/** トーストの連番。Date.now() だと同時 push で衝突する */
let toastSeq = 0

/**
 * UI状態ストア（frontend.md §3）
 *
 * 「どのルームを選んでいるか」「どのパネルが開いているか」など、
 * サーバのデータではない画面状態だけを持つ。データそのものは rooms / messages に置く。
 *
 * 定型文（snippets）はルームに紐づかないマスタデータなので、
 * パレットの表示状態と合わせてここで保持する（ストアは4つに固定するため）。
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    /** @type {number|null} 受信箱で選択中のルームID（/inbox/:roomId と同期） */
    selectedRoomId: null,

    /** 左側のルーム一覧ペイン。閉じるとトークカードが横に広がる */
    roomListOpen: true,

    /** 右側の学生プロフィールパネル（P2-4）。既定は開く */
    profilePanelOpen: true,

    /** プロフィールパネル内の申し送りメモ（P2-5） */
    memoPanelOpen: true,

    /** @type {string} メモのタブ。MEMO_SCOPE のいずれか（P2-5） */
    memoScope: MEMO_SCOPE.PRIVATE,

    /** 定型文パレット（P2-1）：入力欄の先頭で "/" を打つと true */
    snippetPaletteOpen: false,
    /** "/" の後ろに入力された絞り込み文字列 */
    snippetQuery: '',
    /** ↑↓ で移動する選択中インデックス */
    snippetHighlightIndex: 0,
    /** @type {object[]} GET /api/snippets の結果 */
    snippets: [],

    /** @type {number|null} 対応ステータスのドロップダウンを開いているルームID（P1-2） */
    statusMenuRoomId: null,

    /** @type {'connected'|'connecting'|'disconnected'} socket の接続状態バナー用 */
    connectionState: 'connecting',

    /** @type {{id: number, type: 'info'|'error', message: string}[]} 通知トースト */
    toasts: [],
  }),

  getters: {
    /** snippetQuery で絞り込んだ候補（P2-1） */
    filteredSnippets: (s) => [],
    /** ↑↓ で選択中の定型文 */
    highlightedSnippet: (s) => null,
    isOffline: (s) => s.connectionState !== 'connected',
  },

  actions: {
    /** ルーム選択（行クリック）。ルーターの /inbox/:roomId とセットで使う */
    selectRoom(roomId) {
      this.selectedRoomId = roomId === null ? null : Number(roomId)
    },

    /** 左右のペインは最小化できる（トークに集中したいときのため） */
    toggleRoomList() {
      this.roomListOpen = !this.roomListOpen
    },

    toggleProfilePanel() {
      this.profilePanelOpen = !this.profilePanelOpen
    },

    toggleMemoPanel() {},

    /** @param {string} scope MEMO_SCOPE のいずれか */
    setMemoScope(scope) {},

    /** GET /api/snippets（初回のみ） */
    async fetchSnippets() {},

    /** "/" 入力でパレットを開く */
    openSnippetPalette() {},
    closeSnippetPalette() {},
    /** 続けて入力された文字で絞り込む */
    setSnippetQuery(query) {},
    /** @param {number} delta ↑=-1 / ↓=+1 */
    moveSnippetHighlight(delta) {},

    /** 対応ステータスのドロップダウン開閉（P1-2。1クリックで変更するため単一管理） */
    openStatusMenu(roomId) {},
    closeStatusMenu() {},

    /** @param {'connected'|'connecting'|'disconnected'} state */
    setConnectionState(state) {
      this.connectionState = state
    },

    pushToast({ type, message }) {
      this.toasts.push({ id: ++toastSeq, type, message })
    },

    dismissToast(id) {
      this.toasts = this.toasts.filter((toast) => toast.id !== id)
    },

    reset() {
      this.selectedRoomId = null
      this.snippetPaletteOpen = false
      this.snippetQuery = ''
      this.snippetHighlightIndex = 0
      this.snippets = []
      this.statusMenuRoomId = null
      this.connectionState = 'connecting'
      this.toasts = []
    },
  },
})
