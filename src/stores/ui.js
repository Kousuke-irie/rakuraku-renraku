import { defineStore } from 'pinia'
import { alertsApi, companyApi, selectionFlowApi, snippetsApi, toErrorMessage } from '../api/index.js'
import {
  ALERT_KIND_META,
  COMPLIANCE_AI_STATUS,
  DEFAULT_BOARD_GROUP_BY,
  IMPORTANT_ALERT_KINDS,
  MEMO_SCOPE,
  MEMO_SCOPE_VALUES,
} from '../constants/index.js'
import { alertDestination, NOTIFICATIONS_PATH } from '../utils/alertLink.js'

/** トーストの連番。Date.now() だと同時 push で衝突する */
let toastSeq = 0

/**
 * 同時に見せるバナーの上限（P4-6）。
 * これを超えたら古いものから捨てる。画面の右側がバナーで埋まると操作できなくなる。
 */
const MAX_TOASTS = 3

/** 定型文の設定画面（P2-1 拡張）での失敗時の既定文言 */
const SNIPPET_ERROR = Object.freeze({
  FETCH: '定型文の取得に失敗しました',
  CREATE: '定型文の追加に失敗しました',
  UPDATE: '定型文の更新に失敗しました',
  DELETE: '定型文の削除に失敗しました',
})

/** 会社情報（P2-10）での失敗時の既定文言 */
const COMPANY_ERROR = Object.freeze({
  FETCH: '会社情報の取得に失敗しました',
  SAVE: '会社情報の保存に失敗しました',
})

/**
 * ログイン → ホームの円形トランジション（CircleRevealOverlay / useCircleReveal）の進行段階。
 * idle 以外のときだけ画面を覆う円が描画される。
 */
export const CIRCLE_REVEAL_PHASE = Object.freeze({
  IDLE: 'idle',
  /** ログイン画面のロゴの円から画面全体へ広がっている最中 */
  EXPANDING: 'expanding',
  /** 画面を覆いきった。この間に裏側をホームへ差し替え、中心をレールのロゴへ移す */
  COVERED: 'covered',
  /** ナビレールのロゴの円へ縮んでいる最中 */
  COLLAPSING: 'collapsing',
})

/** 円形トランジションの初期状態（= 何も描画しない） */
const emptyCircleReveal = () => ({
  phase: CIRCLE_REVEAL_PHASE.IDLE,
  /** 拡大・収束の中心（viewport 基準・px） */
  x: 0,
  y: 0,
  /** CIRCLE_REVEAL_BASE_DIAMETER に対する倍率。transform: scale() にそのまま渡す */
  scale: 0,
  opacity: 1,
  /**
   * transition を効かせるか。
   * 覆っている間に中心を差し替える一瞬だけ false にする（円が横滑りして見えるため）。
   */
  eased: false,
  durationMs: 0,
  /** cubic-bezier(...) の文字列 */
  easing: 'linear',
})

/** 通知（P4-1）での失敗時の既定文言 */
const ALERT_ERROR = Object.freeze({
  FETCH: '通知の取得に失敗しました',
  READ: '通知の既読化に失敗しました',
})

/** 選考フロー（P2-11 / S-09）での失敗時の既定文言 */
const SELECTION_FLOW_ERROR = Object.freeze({
  FETCH: '選考フローの取得に失敗しました',
  SAVE: '選考フローの保存に失敗しました',
})

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
 * 定型文（snippets）・会社情報（company）・選考フロー（selectionSteps）は
 * ルームに紐づかないマスタデータなので、パレットの表示状態と合わせてここで保持する
 * （ストアは4つに固定するため）。
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

    /**
     * @type {{name: string, description: string|null, recruitSiteUrl: string|null, updatedAt: string}|null}
     * GET /api/company の結果（P2-10）。未設定なら null
     */
    company: null,
    /** company は未設定でも null なので、取得済みかどうかを別に持つ */
    companyLoaded: false,

    /**
     * @type {object[]} 選考フローのステップ設定（P2-11）。人事の設定画面が使う。
     * 会社情報と同じくルーム非依存のマスタデータなのでここに置く
     */
    selectionSteps: [],
    selectionStepsLoaded: false,

    /**
     * @type {{steps: object[], selectionStatus: string|null, isDeclined: boolean}|null}
     * 学生のマイページ（S-09）用。自分の進捗つきのステップ。
     * ★FB は完了済みステップのぶんだけサーバが載せてくる
     */
    myFlow: null,

    /**
     * 送信前チェックの警告ダイアログ（P4-3）。
     * @type {{code:string, category:string, severity:string, message:string, matched:string}[]}
     * 空配列＝閉じている。開いている間は該当ルールの一覧を持つ。
     */
    complianceResults: [],
    /** 警告ダイアログを表示中か。results と分けて持つと閉じるアニメ中に中身が消えない */
    complianceDialogOpen: false,
    /**
     * @type {string} 直近のチェックで LLM 検証が効いたか（COMPLIANCE_AI_STATUS）。
     * ok 以外なら「AIによる検証はできていません」と明示する（P4-2b）。
     */
    complianceAiStatus: COMPLIANCE_AI_STATUS.OK,

    /**
     * @type {object[]} 自分宛の通知（P4-1）。GET /api/alerts の結果。新しい順。
     * 解消済み（返信して片付いたもの）は既定で含まれない。
     * ★ストアは4つに固定する決まりなのでここに置く（frontend.md §3）
     */
    alerts: [],
    /** ナビレールのベルバッジ用。サーバが数えた未読件数をそのまま持つ */
    alertsUnreadCount: 0,
    alertsLoaded: false,
    /**
     * 接続時の同期（syncAlertSummary）を一度でも済ませたか（P4-6）。
     * 初回は「未読が N 件あります」、再接続以降は「増えた分」だけを知らせるための目印。
     */
    alertsSyncedOnce: false,
    /**
     * 通知一覧の絞り込み（P4-1b）。false＝未対応のみ／true＝解消済みも含む。
     * 既定は「未対応のみ」。片付いたものを残すと「上から処理すれば終わる」が崩れる。
     */
    alertsIncludeResolved: false,

    /**
     * ログイン → ホームの円形トランジションの状態（描画は CircleRevealOverlay）。
     * 画面をまたいで続くアニメーションなので、どちらのビューにも属さないここで持つ。
     */
    circleReveal: emptyCircleReveal(),

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

    /** 送信前チェックで検知したルールコード（P4-3。そのまま acknowledgedCodes になる） */
    complianceCodes: (s) => s.complianceResults.map((result) => result.code),
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
      await this.reloadSnippets()
    },

    /** 設定画面での追加・編集・削除のあとに使う、無条件の取り直し */
    async reloadSnippets() {
      try {
        const { data } = await snippetsApi.list()
        this.snippets = data.snippets
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, SNIPPET_ERROR.FETCH) })
      }
    },

    /**
     * POST /api/snippets（設定画面からの追加）
     * @returns {Promise<object|null>} 作成した定型文。失敗時は null
     */
    async createSnippet({ command, title, body }) {
      try {
        const { data } = await snippetsApi.create({ command, title, body })
        this.snippets.push(data.snippet)
        return data.snippet
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, SNIPPET_ERROR.CREATE) })
        return null
      }
    },

    /**
     * PATCH /api/snippets/:id（コマンド・タイトル・本文の編集）
     * @param {number} id
     * @param {{ command?: string, title?: string, body?: string }} patch
     * @returns {Promise<object|null>} 更新後の定型文。失敗時は null
     */
    async updateSnippet(id, patch) {
      try {
        const { data } = await snippetsApi.update(id, patch)
        const index = this.snippets.findIndex((snippet) => snippet.id === id)
        if (index === -1) this.snippets.push(data.snippet)
        else this.snippets = this.snippets.with(index, data.snippet)
        return data.snippet
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, SNIPPET_ERROR.UPDATE) })
        return null
      }
    },

    /**
     * DELETE /api/snippets/:id
     * @returns {Promise<boolean>} 削除できたか
     */
    async deleteSnippet(id) {
      try {
        await snippetsApi.remove(id)
        this.snippets = this.snippets.filter((snippet) => snippet.id !== id)
        return true
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, SNIPPET_ERROR.DELETE) })
        return false
      }
    },

    /**
     * GET /api/company（P2-10）。
     * 更新頻度の低いマスタデータなので、画面を開くたびには取り直さない。
     */
    async fetchCompany() {
      if (this.companyLoaded) return
      await this.reloadCompany()
    },

    /** 設定画面での保存のあとに使う、無条件の取り直し */
    async reloadCompany() {
      try {
        const { data } = await companyApi.get()
        this.company = data.company
        this.companyLoaded = true
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, COMPANY_ERROR.FETCH) })
      }
    },

    /**
     * PUT /api/company（設定画面からの保存・人事のみ）
     * @param {{ name: string, description: string|null, recruitSiteUrl: string|null }} input
     * @returns {Promise<object|null>} 保存後の会社情報。失敗時は null
     */
    async saveCompany(input) {
      try {
        const { data } = await companyApi.update(input)
        this.company = data.company
        this.companyLoaded = true
        this.pushToast({ type: 'info', message: '会社情報を保存しました' })
        return data.company
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, COMPANY_ERROR.SAVE) })
        return null
      }
    },

    /**
     * GET /api/selection-flow（P2-11・人事の設定画面）。
     * 更新頻度の低いマスタデータなので、画面を開くたびには取り直さない。
     */
    async fetchSelectionSteps() {
      if (this.selectionStepsLoaded) return
      await this.reloadSelectionSteps()
    },

    async reloadSelectionSteps() {
      try {
        const { data } = await selectionFlowApi.list()
        this.selectionSteps = data.steps
        this.selectionStepsLoaded = true
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, SELECTION_FLOW_ERROR.FETCH) })
      }
    },

    /**
     * PUT /api/selection-flow（人事のみ）
     * @param {object[]} steps 全ステップ（全置換）
     * @returns {Promise<object[]|null>} 保存後のステップ。失敗時は null
     */
    async saveSelectionSteps(steps) {
      try {
        const { data } = await selectionFlowApi.save(steps)
        this.selectionSteps = data.steps
        this.selectionStepsLoaded = true
        this.pushToast({ type: 'info', message: '選考フローを保存しました' })
        return data.steps
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, SELECTION_FLOW_ERROR.SAVE) })
        return null
      }
    },

    /**
     * GET /api/selection-flow/me（学生のマイページ・S-09）。
     * 選考ステータスは人事がいつでも変えうるので、こちらは開くたびに取り直す。
     */
    async fetchMyFlow() {
      try {
        const { data } = await selectionFlowApi.me()
        this.myFlow = data
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, SELECTION_FLOW_ERROR.FETCH) })
      }
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

    /**
     * 送信前チェックで検知したときにダイアログを開く（P4-3）。
     * @param {object[]} results POST /api/messages/check の結果（1件以上）
     * @param {string} aiStatus COMPLIANCE_AI_STATUS のいずれか
     */
    openComplianceDialog(results, aiStatus = COMPLIANCE_AI_STATUS.OK) {
      if (!Array.isArray(results) || results.length === 0) return
      this.complianceResults = results
      this.complianceAiStatus = aiStatus
      this.complianceDialogOpen = true
    },

    /** 「修正する」「このまま送信」のどちらでも閉じる */
    closeComplianceDialog() {
      this.complianceDialogOpen = false
      this.complianceResults = []
    },

    /** @param {string} status 検知が無かったときも AI の状態だけは記録しておく */
    setComplianceAiStatus(status) {
      this.complianceAiStatus = status
    },

    /** GET /api/alerts（P4-1）。画面を開くたびに取り直す（件数が変わるため） */
    async fetchAlerts() {
      try {
        // includeResolved は「解消済みも見たい」ときだけ付ける（既定は未対応のみ）
        const params = this.alertsIncludeResolved ? { includeResolved: true } : undefined
        const { data } = await alertsApi.list(params)
        this.alerts = data.alerts
        this.alertsUnreadCount = data.unreadCount
        this.alertsLoaded = true
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, ALERT_ERROR.FETCH) })
      }
    },

    /**
     * 通知一覧の絞り込みを切り替えて取り直す（P4-1b）。
     * 解消済みは既定で隠れているため、後から見返す口をここで開ける。
     * @param {boolean} includeResolved
     */
    async setAlertsIncludeResolved(includeResolved) {
      if (this.alertsIncludeResolved === includeResolved) return

      this.alertsIncludeResolved = includeResolved
      this.alertsLoaded = false
      await this.fetchAlerts()
    },

    /** バッジだけ欲しいとき（ナビレール）。一覧は取りに行かない */
    async fetchAlertCount() {
      try {
        const { data } = await alertsApi.list({ unread: true, limit: 1 })
        this.alertsUnreadCount = data.unreadCount
      } catch {
        // バッジが出ないだけなので黙って諦める。トーストを出すほどではない
      }
    },

    /**
     * socket 接続時の通知の同期（P4-6）。
     *
     * 切断中に作られた／解消された通知は `alert:new` / `alert:resolved` が届かない。
     * 件数を数え直したうえで、**溜まっていることをバナーで知らせる**。
     * ベルの数字が黙って変わるだけでは、画面を見ていても気づけない。
     *
     * - 初回接続（ログイン直後）：未読があれば「未読の通知が N 件あります」
     * - 再接続：**増えた分があるときだけ**出す。変化が無いときに出すとうるさい
     *
     * @param {{label?: string}} options 呼び名。学生には「お知らせ」（P4-7）。
     *   ロールは呼び出し側（useSocket）が知っているので、ここで auth を import しない
     */
    async syncAlertSummary({ label = '通知' } = {}) {
      const previousCount = this.alertsUnreadCount
      const isFirstSync = !this.alertsSyncedOnce

      let data
      try {
        ({ data } = await alertsApi.list({ unread: true, limit: 1 }))
      } catch {
        // 数えられないだけ。バナーも出さずに黙って諦める
        return
      }

      this.alertsUnreadCount = data.unreadCount
      this.alertsSyncedOnce = true

      const added = data.unreadCount - previousCount
      if (isFirstSync ? data.unreadCount === 0 : added <= 0) return

      const emphasis = (data.unreadImportantCount ?? 0) > 0
      const message = isFirstSync
        ? `未読の${label}が ${data.unreadCount} 件あります。`
        : `未読の${label}が ${added} 件増えました（未読 ${data.unreadCount} 件）。`

      this.pushToast({
        type: 'info',
        title: emphasis ? `${label}（重要なものがあります）` : label,
        message,
        emphasis,
        to: NOTIFICATIONS_PATH,
        // 再接続を繰り返しても積み上がらないよう、同じ key のものは置き換える
        key: 'alert-summary',
      })
    },

    /**
     * socket `alert:new` で届いた通知を先頭に積む（P4-1）。
     * 同じ id が既にあれば無視する（再接続時の重複配信対策）。
     */
    receiveAlert(alert) {
      if (!alert?.id) return
      if (this.alerts.some((existing) => existing.id === alert.id)) return

      this.alerts = [alert, ...this.alerts]
      if (!alert.readAt) this.alertsUnreadCount += 1

      // ★通知画面を開いていない人に届けるための一手（P4-1b/P4-6）。
      //   ベルの数字が静かに増えるだけでは、その場にいても気づけない。
      //   見出しに種別と学生名、本文に detail を出し、クリックで該当画面へ飛ばす
      const kindLabel = ALERT_KIND_META[alert.kind]?.label ?? '通知'
      this.pushToast({
        type: 'info',
        title: alert.studentName ? `${kindLabel}｜${alert.studentName}` : kindLabel,
        message: alert.detail,
        emphasis: IMPORTANT_ALERT_KINDS.includes(alert.kind),
        to: alertDestination(alert),
      })
    },

    /**
     * socket `alert:resolved` で届いた解消（P4-1b）。
     *
     * `unreadCount` はサーバが数え直した値をそのまま採用する。
     * 一覧を開いていない画面ではローカルに再計算する材料が無く、
     * 自前で減算するとベルの数字だけが実態とずれる。
     * @param {{alertIds: number[], unreadCount: number}} payload
     */
    receiveAlertsResolved({ alertIds, unreadCount } = {}) {
      if (Number.isFinite(unreadCount)) this.alertsUnreadCount = unreadCount
      if (!Array.isArray(alertIds) || alertIds.length === 0) return

      const resolvedIds = new Set(alertIds)

      // 「解消済みを含む」表示中は消さずに解消印を付ける（見ている行が急に消えない）
      if (this.alertsIncludeResolved) {
        const now = new Date().toISOString()
        for (const alert of this.alerts) {
          if (resolvedIds.has(alert.id) && !alert.resolvedAt) alert.resolvedAt = now
        }
        return
      }

      this.alerts = this.alerts.filter((alert) => !resolvedIds.has(alert.id))
    },

    /** 行クリック時。既読化して一覧からは消さない（誤クリックで見失わないため） */
    async markAlertRead(alertId) {
      const target = this.alerts.find((alert) => alert.id === alertId)
      if (!target || target.readAt) return

      try {
        const { data } = await alertsApi.markRead(alertId)
        target.readAt = new Date().toISOString()
        this.alertsUnreadCount = data.unreadCount
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, ALERT_ERROR.READ) })
      }
    },

    async markAllAlertsRead() {
      try {
        const { data } = await alertsApi.markAllRead()
        const now = new Date().toISOString()
        for (const alert of this.alerts) {
          if (!alert.readAt) alert.readAt = now
        }
        this.alertsUnreadCount = data.unreadCount
      } catch (error) {
        this.pushToast({ type: 'error', message: toErrorMessage(error, ALERT_ERROR.READ) })
      }
    },

    /**
     * 円形トランジションの状態を部分更新する（useCircleReveal だけが呼ぶ）。
     * @param {object} patch circleReveal のキーの一部
     */
    patchCircleReveal(patch) {
      this.circleReveal = { ...this.circleReveal, ...patch }
    },

    /** 円を消す（アニメーション完了時・中断時） */
    resetCircleReveal() {
      this.circleReveal = emptyCircleReveal()
    },

    /** @param {'connected'|'connecting'|'disconnected'} state */
    setConnectionState(state) {
      this.connectionState = state
    },

    /**
     * バナー（ToastStack）を1枚積む。
     *
     * @param {object} toast
     * @param {'info'|'error'} toast.type 左端の色帯。error は失敗の報告
     * @param {string} toast.message 本文。1〜2行で読み切れる長さに収める
     * @param {string} [toast.title] 見出し（通知の種別など）。省略時は本文だけの1段表示
     * @param {boolean} [toast.emphasis] 重要。テキストラベルも併記される（色だけに頼らない）
     * @param {string} [toast.to] クリックしたときの遷移先パス。無ければクリックできない
     * @param {string} [toast.key] 同じ key のバナーは**置き換える**。
     *   再接続を繰り返したときに同じまとめバナーが積み上がるのを防ぐ
     */
    pushToast({ type, message, title = null, emphasis = false, to = null, key = null }) {
      if (key) this.toasts = this.toasts.filter((toast) => toast.key !== key)

      this.toasts.push({ id: ++toastSeq, type, message, title, emphasis, to, key })

      // ★上限を超えたら古いものから捨てる。
      //   60秒タイマーが一度に何件も通知を作ることがあり（シード直後が典型）、
      //   そのぶんバナーを積むと画面の右側が埋まって操作できなくなる。実測で踏んだ。
      if (this.toasts.length > MAX_TOASTS) {
        this.toasts = this.toasts.slice(this.toasts.length - MAX_TOASTS)
      }
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
      this.company = null
      this.companyLoaded = false
      this.selectionSteps = []
      this.selectionStepsLoaded = false
      this.myFlow = null
      this.complianceResults = []
      this.complianceDialogOpen = false
      this.complianceAiStatus = COMPLIANCE_AI_STATUS.OK
      this.alerts = []
      this.alertsUnreadCount = 0
      this.alertsLoaded = false
      this.alertsIncludeResolved = false
      this.alertsSyncedOnce = false
      this.circleReveal = emptyCircleReveal()
      this.connectionState = 'connecting'
      this.toasts = []
    },
  },
})
