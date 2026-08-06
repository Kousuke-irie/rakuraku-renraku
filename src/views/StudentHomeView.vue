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
import { FLOW_STEP_STATE } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useUiStore } from "../stores/ui.js"
import CompanyPanel from "../components/CompanyPanel.vue"
import SelectionFlow from "../components/SelectionFlow.vue"
import SelectionStepDetail from "../components/SelectionStepDetail.vue"

// #region global state
const auth = useAuthStore()
const ui = useUiStore()
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

const selectedStep = computed(
  () => steps.value.find((step) => step.statusKey === selectedKey.value) ?? null
)

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
        >
          各ステップを選ぶと、内容とポイントを確認できます。
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
          :steps="steps"
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

.board__closed {
  margin: 0;
  padding: 0 var(--space-xxl) var(--space-xxl);
  color: var(--color-ink-mute);
  font-size: 13px;
  line-height: 1.8;
}
</style>
