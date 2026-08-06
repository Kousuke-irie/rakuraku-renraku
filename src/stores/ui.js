import { defineStore } from 'pinia'
import { snippetsApi } from '../api/snippets.js'
import { DEFAULT_BOARD_GROUP_BY, MEMO_SCOPE, MEMO_SCOPE_VALUES } from '../constants/index.js'

/** トーストの連番。Date.now() だと同時 push で衝突する */
let toastSeq = 0

/**
 * 受信箱3ペインの幅（px）。既定値とドラッグで動かせる範囲。
 * 列挙値ではなく画面レイアウトの寸法なので shared/constants.js には置かない。
 * トークペインが潰れないよう、上限は InboxView が実際の横幅から算出する。
 */
export const PANE_WIDTH = Object.freeze({
  ROOM_LIST: 360,
  ROOM_LIST_MIN: 280,
  DETAIL: 320,
  DETAIL_MIN: 260,
  /** トークペインに最低限残す幅 */
  CHAT_MIN: 360,
  /** 最小化した側に残すレールの幅（アイコンボタン 28px ＋ 左右 8px） */
  RAIL: 44,
  /** ペインの隙間＝ドラッグ用のつまみの幅 */
  RESIZER: 12,
})

/** 幅を変えられるペイン → state のキー */
const PANE_WIDTH_KEY = Object.freeze({
  roomList: 'roomListWidth',
  detail: 'detailWidth',
})

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

    /** ルーム一覧ペインの幅（px）。ペイン間のつまみをドラッグして変える */
    roomListWidth: PANE_WIDTH.ROOM_LIST,

    /** 詳細ペインの幅（px） */
    detailWidth: PANE_WIDTH.DETAIL,

    /** プロフィールパネル内の申し送りメモ（P2-5） */
    memoPanelOpen: true,

    /** ホーム右カラムの AI 現況サマリー（S-07 / P3-1a）。右下の円形ボタンで開閉する */
    aiPanelOpen: true,

    /** @type {string} ホームのボードを縦割りにする軸。BOARD_GROUP_BY のいずれか（S-07） */
    boardGroupBy: DEFAULT_BOARD_GROUP_BY,

    /** 自分のプロフィール編集ダイアログ（ナビレールのアイコンから開く。B-5） */
    profileDialogOpen: false,

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

    /** @type {'connected'|'connecting'|'disconnected'} socket の接続状態バナー用 */
    connectionState: 'connecting',

    /** @type {{id: number, type: 'info'|'error', message: string}[]} 通知トースト */
    toasts: [],
  }),

  getters: {
    /** snippetQuery で絞り込んだ候補（P2-1）。"/" を除いた部分文字列で command を前方一致させる */
    filteredSnippets: (s) => {
      const query = s.snippetQuery.trim()
      if (!query) return s.snippets

      return s.snippets.filter((snippet) => snippet.command.startsWith(`/${query}`))
    },
    /** ↑↓ で選択中の定型文 */
    highlightedSnippet() {
      return this.filteredSnippets[this.snippetHighlightIndex] ?? null
    },
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

    /**
     * ペインの幅を変える（つまみのドラッグ／キーボード操作）。
     * 上限・下限の判定は呼び出し側（PaneResizer）が行う。
     * @param {'roomList'|'detail'} pane
     * @param {number} width px
     */
    setPaneWidth(pane, width) {
      const key = PANE_WIDTH_KEY[pane]
      if (!key || !Number.isFinite(width)) return
      this[key] = Math.round(width)
    },

    toggleMemoPanel() {
      this.memoPanelOpen = !this.memoPanelOpen
    },

    /** ホームの AI パネル開閉（右下の円形ボタン／カードの閉じるボタン） */
    toggleAiPanel() {
      this.aiPanelOpen = !this.aiPanelOpen
    },

    /** @param {string} groupBy BOARD_GROUP_BY のいずれか（ホームの縦割り軸を切り替える） */
    setBoardGroupBy(groupBy) {
      this.boardGroupBy = groupBy
    },

    /** 自分のプロフィール編集ダイアログ（B-5） */
    openProfileDialog() {
      this.profileDialogOpen = true
    },

    closeProfileDialog() {
      this.profileDialogOpen = false
    },

    /** @param {string} scope MEMO_SCOPE のいずれか（メモのタブ切替・P2-5） */
    setMemoScope(scope) {
      if (!MEMO_SCOPE_VALUES.includes(scope)) return
      this.memoScope = scope
    },

    /** GET /api/snippets（初回のみ。マスタデータなのでルーム切替のたびに取り直さない） */
    async fetchSnippets() {
      if (this.snippets.length > 0) return

      const { data } = await snippetsApi.list()
      this.snippets = data.snippets
    },

    /** "/" 入力でパレットを開く */
    async openSnippetPalette() {
      this.snippetPaletteOpen = true
      this.snippetQuery = ''
      this.snippetHighlightIndex = 0
      await this.fetchSnippets()
    },
    closeSnippetPalette() {
      this.snippetPaletteOpen = false
      this.snippetQuery = ''
      this.snippetHighlightIndex = 0
    },
    /** 続けて入力された文字で絞り込む。候補が変わるので選択位置は先頭に戻す */
    setSnippetQuery(query) {
      this.snippetQuery = query
      this.snippetHighlightIndex = 0
    },
    /** @param {number} delta ↑=-1 / ↓=+1 */
    moveSnippetHighlight(delta) {
      const count = this.filteredSnippets.length
      if (count === 0) return

      this.snippetHighlightIndex = (this.snippetHighlightIndex + delta + count) % count
    },

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
      this.roomListWidth = PANE_WIDTH.ROOM_LIST
      this.detailWidth = PANE_WIDTH.DETAIL
      this.aiPanelOpen = true
      this.boardGroupBy = DEFAULT_BOARD_GROUP_BY
      this.profileDialogOpen = false
      this.memoScope = MEMO_SCOPE.PRIVATE
      this.snippetPaletteOpen = false
      this.snippetQuery = ''
      this.snippetHighlightIndex = 0
      this.snippets = []
      this.connectionState = 'connecting'
      this.toasts = []
    },
  },
})
