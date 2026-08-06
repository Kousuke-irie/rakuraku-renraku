<script setup>
// S-09 学生マイページ（frontend.md §1・§7-3）
//
// 学生のログイン後の着地点。上に会社情報、下に選考フローの進捗。
// 「いま自分がどこにいて、次に何があるか」を開いた瞬間に分かる状態にするのが目的。
//
// 返信はここでは行わない。チャットはナビレールから /chat へ。
//
// データは1回の GET /selection-flow/me でまとめて取る（往復を増やさない）。
// ★見せてよいフィードバックの判断はサーバが持つ。ここでは受け取ったものを描くだけ。
import { computed, nextTick, onMounted, ref, watch } from "vue"
import { FLOW_STEP_STATE, STUDENT_NOTE_OVERALL_KEY } from "../constants/index.js"
import { useFeedbackReads } from "../composables/useFeedbackReads.js"
import { useAuthStore } from "../stores/auth.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import CompanyPanel from "../components/CompanyPanel.vue"
import SelectionFlow from "../components/SelectionFlow.vue"
import SelectionStepDetail from "../components/SelectionStepDetail.vue"
import StudentChatCard from "../components/StudentChatCard.vue"
import StudentNoteEditor from "../components/StudentNoteEditor.vue"

// #region global state
const auth = useAuthStore()
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region local variable
// 既読は端末に持つ（useFeedbackReads）。ログイン中は本人が変わらないので初期化は1回でよい
const { isUnread, markRead } = useFeedbackReads(auth.currentUserId)
// #endregion

// #region local state
/** @type {import('vue').Ref<string|null>} 詳細を開いているステップ */
const selectedKey = ref(null)

/**
 * 面接アンケート（frontend.md §7-3）の回答済み statusKey 集合。
 * ★フロントエンドのみのモック。バックエンド未実装のためここに置き、リロードで消える。
 * @type {import('vue').Ref<Set<string>>}
 */
const answeredSurveyKeys = ref(new Set())
// #endregion

// #region computed
const userName = computed(() => auth.user?.displayName ?? "")

const flow = computed(() => ui.myFlow)
const steps = computed(() => flow.value?.steps ?? [])
const isDeclined = computed(() => Boolean(flow.value?.isDeclined))

const currentStep = computed(
  () => steps.value.find((step) => step.state === FLOW_STEP_STATE.CURRENT) ?? null
)

/** 図に渡すステップ。未読かどうかの判定はここで済ませ、SelectionFlow は描くことに専念させる */
const flowSteps = computed(() =>
  steps.value.map((step) => ({ ...step, isUnreadFeedback: isUnread(step) }))
)

const feedbackCount = computed(() => steps.value.filter((step) => step.feedback).length)
const unreadCount = computed(() => steps.value.filter((step) => isUnread(step)).length)

/**
 * フロー図の上の一文。
 * 未読があるならその件数を先に言う。図の点を探す前に「何か届いている」と分かるように。
 */
const flowNote = computed(() => {
  if (unreadCount.value > 0) {
    return `新しいフィードバックが${unreadCount.value}件届いています。丸を選ぶと読めます。`
  }
  if (feedbackCount.value > 0) {
    return `企業からのフィードバックが${feedbackCount.value}件届いています。`
  }
  return "各ステップを選ぶと、内容とポイントを確認できます。"
})

const selectedStep = computed(
  () => steps.value.find((step) => step.statusKey === selectedKey.value) ?? null
)

/**
 * 選考全体のメモ（S-10）。ステップに属さない「志望動機の軸」「企業研究」の置き場。
 * 辞退している場合は出さない（これから書く相手のいないメモ欄を残しても意味がないため）。
 */
const overallNote = computed(() => flow.value?.overallNote ?? null)
const showOverallNote = computed(() => Boolean(flow.value) && !isDeclined.value)

/**
 * 下段を出すか。
 * ★辞退していてもチャットカードは残す。選考が終わったあとこそ、
 *   問い合わせ先が画面から消えていると学生は行き場を失う。
 */
const showBottom = computed(() => Boolean(flow.value))

/**
 * 面接アンケート未回答の statusKey（frontend.md §7-3）。
 * 完了済みの面接ステップ（statusKey が interview_ で始まる）のうち、まだ回答していないもの。
 */
const pendingSurveyKeys = computed(() =>
  steps.value
    .filter(
      (step) =>
        step.state === FLOW_STEP_STATE.DONE &&
        step.statusKey.startsWith("interview_") &&
        !answeredSurveyKeys.value.has(step.statusKey)
    )
    .map((step) => step.statusKey)
)

const selectedStepSurveyAnswered = computed(
  () => selectedStep.value !== null && answeredSurveyKeys.value.has(selectedStep.value.statusKey)
)

// 「いまは○○の段階です」という一文は置かない。
// 現在地はフロー図（持ち上がった山の頂上＋オレンジ）が示すので、同じことを
// 文章でも言うと視線が二重になる。読み上げ用には各ノードの状態ラベルが残る。
// #endregion

// #region lifecycle
onMounted(() => {
  // 会社情報はマスタデータなので初回だけ。進捗は人事がいつでも変えるので毎回取り直す
  ui.fetchCompany()
  ui.fetchMyFlow()

  // チャットカードの未読件数と最新メッセージ。
  // ★取得済みでも必ず取り直す。`room:updated` はサーバが `io.in('hr')` にしか配信して
  //   おらず（services/realtime.js）、学生のストアは socket では最新化されない。
  //   チャットで既読にして戻ってきたときに、古い未読件数を出さないため。
  rooms.fetchRooms()
})

// 既定で現在地の詳細を開いておく。学生がまず知りたいのは「いま」のことなので、
// 着地してから1クリックさせない
watch(
  currentStep,
  (step) => {
    if (selectedKey.value === null && step) selectedKey.value = step.statusKey
  },
  { immediate: true }
)

// 現在地が無い（内定・辞退・未設定）ときは先頭を開く
watch(steps, (list) => {
  if (selectedKey.value === null && list.length > 0) selectedKey.value = list[0].statusKey
})

// 詳細を開いた＝FBの本文が画面に出た、とみなして既読にする。
// 開くまでは未読のまま残るので、学生が気づかないうちに目印が消えることはない
watch(selectedStep, (step) => markRead(step), { immediate: true })
// #endregion

// #region browser event handler
const onSelect = (statusKey) => {
  // バッジ付き（アンケート未回答）のステップをクリックしたときだけ、
  // 詳細エリアのアンケートカードまでスクロールする（frontend.md §7-3）
  const shouldScrollToSurvey = pendingSurveyKeys.value.includes(statusKey)

  selectedKey.value = statusKey

  if (!shouldScrollToSurvey) return

  nextTick(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    document
      .getElementById("survey-card")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  })
}

const onSurveyAnswered = (statusKey) => {
  answeredSurveyKeys.value.add(statusKey)
}
// #endregion
</script>

<template>
  <div class="mypage">
    <!-- 上：会社情報（P2-10 のパネルを横長レイアウトで使い回す） -->
    <CompanyPanel layout="banner" />

    <!-- 下：選考フロー -->
    <section
      class="board"
      aria-labelledby="flow-heading"
    >
      <header class="board__head">
        <p class="board__eyebrow">
          マイページ
        </p>
        <h1
          id="flow-heading"
          class="board__title"
        >
          {{ userName }} さんの選考状況
        </h1>
        <p
          v-if="!isDeclined && steps.length > 0"
          class="board__note"
          :class="{ 'board__note--alert': unreadCount > 0 }"
        >
          <!-- オレンジは面と装飾で使い、本文の色には使わない（DESIGN.md） -->
          <span
            v-if="unreadCount > 0"
            class="board__dot"
            aria-hidden="true"
          />
          {{ flowNote }}
        </p>
      </header>

      <p
        v-if="isDeclined"
        class="board__closed"
      >
        またご縁がありましたらお待ちしております。ご質問はチャットからお問い合わせいただけます。
      </p>

      <template v-else-if="steps.length > 0">
        <SelectionFlow
          :steps="flowSteps"
          :selected-key="selectedKey"
          :survey-pending-keys="pendingSurveyKeys"
          @select="onSelect"
        />

        <SelectionStepDetail
          :step="selectedStep"
          :survey-answered="selectedStepSurveyAnswered"
          @survey-answered="onSurveyAnswered"
        />
      </template>

      <p
        v-else
        class="board__closed"
      >
        選考フローの公開をお待ちください。
      </p>
    </section>

    <!-- 下段：自分が書くもの（左）と、担当者とのやり取り（右） -->
    <div
      v-if="showBottom"
      class="bottom"
      :class="{ 'bottom--single': !showOverallNote }"
    >
      <!-- 選考全体のメモ（S-10）。ステップに紐づかない考えごとの置き場 -->
      <StudentNoteEditor
        v-if="showOverallNote"
        :note-key="STUDENT_NOTE_OVERALL_KEY"
        :note="overallNote"
        label="選考全体のメモ"
        placeholder="志望動機の軸、企業研究、選考を通して感じたことなど（自分にだけ見えます）"
        :rows="6"
      />

      <StudentChatCard />
    </div>
  </div>
</template>

<style scoped>
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めて中央寄せするだけ */
.mypage {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  height: 100%;
  max-width: 1160px;
  margin: 0 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-xs) 0 var(--space-sm);
}

/* トークカード・会社情報パネルと同じ「白カード」の作りに揃える */
.board {
  flex: none;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.board__head {
  padding: var(--space-xxl) var(--space-xxl) var(--space-lg);
}

.board__eyebrow {
  margin: 0 0 var(--space-xs);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

/* 見出しだけスケールを上げて、開いた瞬間に現在地が読めるようにする */
.board__title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.board__note {
  margin: var(--space-sm) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

/* 未読のFBがあるときだけ、この一文を本文の濃さまで持ち上げる。
   面や枠は足さない（主役はあくまで下のフロー図）。
   ★オレンジは本文の色に使わない（DESIGN.md）。色ではなく濃さと点で差をつける */
.board__note--alert {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  color: var(--color-ink);
  font-weight: 700;
}

/* 図の中の「FBあり」の点と同じ印。文章と図で同じ記号を使い、対応関係を作る */
.board__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
}

/* 下段は選考フローのカードとは別の紙にする。
   会社が用意した情報（上）と、自分が書くもの・担当者とのやり取り（下）を境目で分ける。
   メモを広く取り、チャットカードは要点だけの幅に収める */
.bottom {
  display: grid;
  flex: none;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: var(--space-md);
  /* 底を揃える。高さの違う2枚が並ぶと、下に段差ができて雑に見える */
  align-items: stretch;
  padding-bottom: var(--space-sm);
}

/* 辞退時はメモが消えてチャットカードだけが残る。
   1枚だけ全幅に伸ばすと締まらないので、右寄せの手紙くらいの幅に留める */
.bottom--single {
  grid-template-columns: minmax(0, 380px);
  justify-content: end;
}

@media (max-width: 900px) {
  .bottom,
  .bottom--single {
    grid-template-columns: minmax(0, 1fr);
  }
}

.board__closed {
  margin: 0;
  padding: 0 var(--space-xxl) var(--space-xxl);
  color: var(--color-ink-mute);
  font-size: 13px;
  line-height: 1.8;
}
</style>
