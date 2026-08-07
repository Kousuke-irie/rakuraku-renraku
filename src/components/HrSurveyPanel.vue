<script setup>
// 人事FBアンケートの集計（S-12）。監視ダッシュボードの「全社」タブに置く。
//
// ★この画面（/dashboard）の主語は**人事の対応品質**なので、ここに載せる。
//   面接官の面接品質（S-11）は主語が違うため /interviews に分けたまま。
//   同じ画面に混ぜると「誰の何を改善するのか」が二重になる。
//
// ★この画面に「誰が書いたか」は出ない。サーバが返していない（api/hrSurveys.js）。
//   「特定されません」と約束して集めた回答なので、辿れる経路を作らない。
//   回答が少ない担当者の自由記述もサーバ側で落ちる。ここで絞り込まないこと。
//
// 構成は3段。
//   上 … 担当者どうしを**比べる**（横棒。総合平均）
//   中 … **どの軸が弱いか**を見る（横棒。全社平均＋選考結果別）
//   下 … 1つのスコープを**読む**（ドロップダウンで全体／担当者を切り替える）
// 棒グラフをドロップダウンに連動させない。比較が目的の図から比較対象を消してしまう。
import { computed, onMounted, ref, watch } from "vue"
import { Bar } from "vue-chartjs"
import { hrSurveysApi, toErrorMessage } from "../api/index.js"
import {
  AI_SUMMARY_STATUS,
  HR_SURVEY_AXIS_META,
  HR_SURVEY_AXIS_VALUES,
  HR_SURVEY_RATING_MAX,
  HR_SURVEY_SCOPE_ALL,
} from "../constants/index.js"
import { BAR_STYLE, CHART_COLOR, ratingBarOptions } from "../plugins/charts.js"
import { useUiStore } from "../stores/ui.js"
import ChartPanel from "./ChartPanel.vue"

const props = defineProps({
  /**
   * GET /api/dashboard の `hrSurvey`。
   * ★集計は親（全社タブ）が1往復で取ったものを受け取る。ここで取り直さない。
   *   自由記述とAI要約だけは、スコープを切り替えるたびに取りに行く必要があるので
   *   このコンポーネントが持つ。
   */
  data: { type: Object, default: null },
})

// #region constants
const FETCH_ERROR = "人事アンケートの取得に失敗しました"
/** 1行の高さ。担当者が増えてもバーの太さが変わらないようにする */
const ROW_HEIGHT = 46
const MIN_CHART_HEIGHT = 160
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
/** @type {import('vue').Ref<object|null>} 選択スコープの自由記述 */
const commentData = ref(null)
/** @type {import('vue').Ref<object|null>} 選択スコープのAI要約 */
const summary = ref(null)

const scopeId = ref(HR_SURVEY_SCOPE_ALL)
const textLoading = ref(false)
// #endregion

// #region computed
const assignees = computed(() => props.data?.assignees ?? [])
const overall = computed(
  () => props.data?.overall ?? { count: 0, avgOverall: null, axisAverages: {} }
)
const outcomes = computed(() => props.data?.outcomes ?? [])
const suppressed = computed(
  () => props.data?.suppressed ?? { assigneeCount: 0, responseCount: 0 }
)
const minSampleSize = computed(() => props.data?.minSampleSize ?? 3)

/** 回答率。分母は「選考が終わった学生」の数（サーバが数える） */
const answerRate = computed(() => {
  const answerable = props.data?.answerableCount ?? 0
  if (answerable === 0) return null
  return Math.round((overall.value.count / answerable) * 100)
})

const kpiTiles = computed(() => [
  {
    key: "count",
    label: "回答数",
    value: overall.value.count,
    note: `選考を終えた学生 ${props.data?.answerableCount ?? 0} 名中`,
  },
  {
    key: "rate",
    label: "回答率",
    value: answerRate.value === null ? "—" : `${answerRate.value}%`,
    note: "内定・辞退の学生に対する割合",
  },
  {
    key: "avg",
    label: "総合満足度",
    value: overall.value.avgOverall === null ? "—" : overall.value.avgOverall,
    note: `${HR_SURVEY_RATING_MAX}点満点・3軸の平均。伏せた回答も含む`,
  },
])

// --- ① 担当者別 総合満足度 ---
// 単一系列なので単一色。段階ではなく「同じ指標の値どうし」を比べる図で、
// 色に持たせる意味が無い（凡例も付けない＝ChartPanel の legend を渡さない）。
//
// 母数はラベルに添える。★4.5（3件）と★4.0（30件）を同じ強さで読ませないため。
const assigneeChart = computed(() => ({
  labels: assignees.value.map((row) => `${row.displayName}（${row.count}件）`),
  datasets: [
    {
      data: assignees.value.map((row) => row.avgOverall),
      backgroundColor: CHART_COLOR.PRIMARY,
      ...BAR_STYLE,
    },
  ],
}))

/** 「表で見る」用。3軸の内訳まで出す（グラフでは総合しか読めないため） */
const assigneeRows = computed(() =>
  assignees.value.map((row) => [
    row.displayName,
    row.count,
    row.avgOverall,
    ...HR_SURVEY_AXIS_VALUES.map((axis) => row.axisAverages[axis] ?? "—"),
  ])
)

const assigneeColumns = computed(() => [
  "担当者",
  "回答数",
  "総合",
  ...HR_SURVEY_AXIS_VALUES.map((axis) => HR_SURVEY_AXIS_META[axis].label),
])

const assigneeChartHeight = computed(() =>
  Math.max(MIN_CHART_HEIGHT, assignees.value.length * ROW_HEIGHT + 40)
)

// --- ② 評価軸別 平均 ---
// ★ここが3軸に分けた理由そのもの。総合★だけでは「対応は丁寧だが連絡が遅い」が
//   平均に埋もれて読めない。どの軸を直すのかがこの図で決まる。
const axisChart = computed(() => ({
  labels: HR_SURVEY_AXIS_VALUES.map((axis) => HR_SURVEY_AXIS_META[axis].label),
  datasets: [
    {
      data: HR_SURVEY_AXIS_VALUES.map((axis) => overall.value.axisAverages?.[axis] ?? 0),
      backgroundColor: CHART_COLOR.PRIMARY,
      ...BAR_STYLE,
    },
  ],
}))

/**
 * 「表で見る」には選考結果別の内訳も出す。
 * 内定者と辞退者では傾向がまるで違うので、平均1本だけだと読み違える。
 */
const axisRows = computed(() => {
  const rows = [
    [
      "全体",
      overall.value.count,
      ...HR_SURVEY_AXIS_VALUES.map((axis) => overall.value.axisAverages?.[axis] ?? "—"),
    ],
  ]

  for (const outcome of outcomes.value) {
    rows.push([
      outcome.label,
      outcome.count,
      ...HR_SURVEY_AXIS_VALUES.map((axis) => outcome.axisAverages[axis] ?? "—"),
    ])
  }
  return rows
})

const axisColumns = computed(() => [
  "選考結果",
  "回答数",
  ...HR_SURVEY_AXIS_VALUES.map((axis) => HR_SURVEY_AXIS_META[axis].label),
])

/** 伏せた担当者がいることは隠さない。数字が合わないと集計そのものが信用されない */
const suppressedNote = computed(() => {
  const { assigneeCount, responseCount } = suppressed.value
  if (assigneeCount === 0) return ""

  return (
    `回答が${minSampleSize.value}件に満たない担当者${assigneeCount}名（計${responseCount}件）は、` +
    "回答者が特定できてしまうため個別に表示していません。上の全体の数字には含まれています。"
  )
})

// --- ③ 自由記述 ---
const scopeOptions = computed(() => [
  { value: HR_SURVEY_SCOPE_ALL, label: "全体" },
  ...assignees.value.map((row) => ({ value: row.id, label: row.displayName })),
])

const scopeLabel = computed(
  () => scopeOptions.value.find((option) => option.value === scopeId.value)?.label ?? "全体"
)

const comments = computed(() => commentData.value?.comments ?? [])
const isScopeSuppressed = computed(() => Boolean(commentData.value?.isSuppressed))

const summaryStatus = computed(() => summary.value?.status ?? AI_SUMMARY_STATUS.IDLE)
const hasSummary = computed(() => summaryStatus.value === AI_SUMMARY_STATUS.READY)

/** AI要約が出せないときの説明。原文は下に出るので画面は成立する */
const summaryNote = computed(() => {
  if (isScopeSuppressed.value) {
    return `回答が${minSampleSize.value}件に満たないため、この担当者へのご意見は表示していません。`
  }
  if (comments.value.length === 0) return "このスコープに自由記述の回答はまだありません。"

  switch (summaryStatus.value) {
    case AI_SUMMARY_STATUS.UNAVAILABLE:
      return "AI要約は設定されていません（GEMINI_API_KEY 未設定）。下の原文をご確認ください。"
    case AI_SUMMARY_STATUS.ERROR:
      return summary.value?.error ?? "要約を生成できませんでした。下の原文をご確認ください。"
    case AI_SUMMARY_STATUS.LOADING:
      return "要約を生成しています…"
    default:
      return ""
  }
})
// #endregion

// #region function
/**
 * 選択スコープの原文とAI要約。
 * 原文を先に描き、要約は後から差し込む（要約待ちで読み始められないのを避ける）。
 */
async function fetchTextData(force = false) {
  textLoading.value = true
  summary.value = { status: AI_SUMMARY_STATUS.LOADING }

  try {
    const { data: payload } = await hrSurveysApi.comments(scopeId.value)
    commentData.value = payload
  } catch (error) {
    commentData.value = null
    ui.pushToast({ type: "error", message: toErrorMessage(error, FETCH_ERROR) })
  } finally {
    textLoading.value = false
  }

  try {
    const { data: payload } = await hrSurveysApi.aiSummary(scopeId.value, { force })
    summary.value = payload
  } catch (error) {
    summary.value = {
      status: AI_SUMMARY_STATUS.ERROR,
      error: toErrorMessage(error, "要約を生成できませんでした"),
    }
  }
}
// #endregion

// #region lifecycle
onMounted(() => {
  void fetchTextData()
})

// ドロップダウンを変えたら原文と要約を取り直す。
// ★絞り込みを画面側でやらない（回答の少ない担当者の本文がクライアントに届いてしまう）
watch(scopeId, () => {
  void fetchTextData()
})

// 親が「更新」を押して集計が入れ替わったら、原文と要約も取り直す。
// ★初回（親の取得完了で null → 値）は onMounted のぶんで足りるので飛ばす。
//   ここで拾うと、画面を開くたびに同じ要約を2回取りに行くことになる。
watch(
  () => props.data,
  (next, previous) => {
    if (!previous) return
    void fetchTextData(true)
  }
)
// #endregion
</script>

<template>
  <section class="hr-survey">
    <header class="hr-survey__head">
      <h2 class="hr-survey__title">
        人事対応の満足度（選考終了後アンケート）
      </h2>
      <p class="hr-survey__note">
        内定・辞退が決まった学生に、担当者とのやり取りについて答えてもらったものです。
        <strong>回答者は表示されません。</strong>
      </p>
    </header>

    <!-- 数字そのものが答えなのでグラフにしない（全社タブの KPI と同じ方針） -->
    <ul class="kpi">
      <li
        v-for="tile in kpiTiles"
        :key="tile.key"
        class="kpi__tile"
      >
        <p class="kpi__label">
          {{ tile.label }}
        </p>
        <p class="kpi__value">
          {{ tile.value }}
        </p>
        <p class="kpi__note">
          {{ tile.note }}
        </p>
      </li>
    </ul>

    <div class="grid">
      <ChartPanel
        title="担当者別 総合満足度"
        :note="`${HR_SURVEY_RATING_MAX}点満点・3軸の平均。かっこ内は回答数で、少ないほど平均は振れます`"
        :columns="assigneeColumns"
        :rows="assigneeRows"
        empty-text="表示できる回答がまだありません"
        :height="assigneeChartHeight"
      >
        <Bar
          :data="assigneeChart"
          :options="ratingBarOptions(HR_SURVEY_RATING_MAX)"
        />
      </ChartPanel>

      <ChartPanel
        title="評価軸別 平均（全社）"
        :note="`${HR_SURVEY_RATING_MAX}点満点。表では内定・辞退の別も見られます`"
        :columns="axisColumns"
        :rows="axisRows"
        empty-text="表示できる回答がまだありません"
        :height="MIN_CHART_HEIGHT"
      >
        <Bar
          :data="axisChart"
          :options="ratingBarOptions(HR_SURVEY_RATING_MAX)"
        />
      </ChartPanel>
    </div>

    <p
      v-if="suppressedNote"
      class="hr-survey__suppressed"
    >
      {{ suppressedNote }}
    </p>

    <section class="panel">
      <header class="panel__head">
        <div>
          <h3 class="panel__title">
            ご意見のまとめ
          </h3>
          <p class="panel__note">
            {{ scopeLabel }}に寄せられた自由記述を、AIが共通する内容でまとめています
          </p>
        </div>

        <label class="scope">
          <span class="scope__label">表示範囲</span>
          <select
            v-model="scopeId"
            class="scope__select"
          >
            <option
              v-for="option in scopeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </header>

      <p
        v-if="summaryNote"
        class="summary__note"
      >
        {{ summaryNote }}
      </p>

      <div
        v-if="hasSummary"
        class="summary"
      >
        <p class="summary__overview">
          {{ summary.overview }}
        </p>

        <div class="summary__columns">
          <!-- 見出しに「よかった点／気になった点」を必ず書く。
               色だけで良し悪しを伝えない（CLAUDE.md §6-13） -->
          <div class="summary__group">
            <h4 class="summary__heading summary__heading--good">
              よかった点
            </h4>
            <ul
              v-if="summary.positives.length > 0"
              class="summary__list"
            >
              <li
                v-for="point in summary.positives"
                :key="point"
              >
                {{ point }}
              </li>
            </ul>
            <p
              v-else
              class="summary__empty"
            >
              共通して挙がった内容はありません
            </p>
          </div>

          <div class="summary__group">
            <h4 class="summary__heading summary__heading--bad">
              気になった点
            </h4>
            <ul
              v-if="summary.concerns.length > 0"
              class="summary__list"
            >
              <li
                v-for="point in summary.concerns"
                :key="point"
              >
                {{ point }}
              </li>
            </ul>
            <p
              v-else
              class="summary__empty"
            >
              共通して挙がった内容はありません
            </p>
          </div>
        </div>
      </div>

      <!-- 要約の根拠。要約が出せなくてもここは読めるようにしておく -->
      <div class="raw">
        <h4 class="raw__title">
          回答の原文（{{ comments.length }}件）
        </h4>
        <p
          v-if="textLoading"
          class="raw__empty"
        >
          読み込み中…
        </p>
        <ul
          v-else-if="comments.length > 0"
          class="raw__list"
        >
          <li
            v-for="comment in comments"
            :key="comment.id"
            class="raw__item"
          >
            <p class="raw__meta">
              <span class="raw__rating">★{{ comment.avgOverall }}</span>
              <span class="raw__outcome">{{ comment.outcomeLabel }}</span>
            </p>
            <p class="raw__body">
              {{ comment.body }}
            </p>
          </li>
        </ul>
        <p
          v-else
          class="raw__empty"
        >
          表示できる回答はありません。
        </p>
      </div>
    </section>
  </section>
</template>

<style scoped>
.hr-survey {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.hr-survey__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.hr-survey__note {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.hr-survey__suppressed {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border-left: 3px solid var(--color-hairline);
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.7;
}

/* --- KPI（全社タブの .kpi と同じ寸法。あちらは4枚、こちらは3枚） --- */
.kpi {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.kpi__tile {
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
}

.kpi__label {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.kpi__value {
  margin: 2px 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.kpi__note {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

/* --- ご意見のまとめ --- */
.panel {
  padding: var(--space-lg) var(--space-xl);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
}

.panel__head {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.panel__note {
  margin: 2px 0 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.scope {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-sm);
  align-items: center;
}

.scope__label {
  color: var(--color-ink-mute);
  font-size: 11px;
}

.scope__select {
  padding: 4px 8px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font: inherit;
  font-size: 12px;
}

.summary__note {
  margin: 0 0 var(--space-md);
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.7;
}

.summary {
  margin-bottom: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas-cream);
}

.summary__overview {
  margin: 0 0 var(--space-md);
  font-size: 13px;
  line-height: 1.8;
}

.summary__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-lg);
}

.summary__heading {
  margin: 0 0 var(--space-xs);
  padding-bottom: 4px;
  border-bottom: 2px solid var(--color-hairline);
  font-size: 12px;
  font-weight: 700;
}

.summary__heading--good {
  border-bottom-color: #3b7fc4;
}

.summary__heading--bad {
  border-bottom-color: #d03b3b;
}

.summary__list {
  margin: 0;
  padding-left: 1.2em;
  font-size: 12px;
  line-height: 1.9;
}

.summary__empty {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.raw__title {
  margin: 0 0 var(--space-sm);
  font-size: 12px;
  font-weight: 700;
}

/* ページ自体がスクロールするので、ここに2つ目のスクロール領域を作らない。
   入れ子のスクロールは、外側を動かしたつもりで内側が動いて迷子になる */
.raw__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.raw__item {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-sm, 4px);
}

.raw__meta {
  display: flex;
  gap: var(--space-sm);
  margin: 0 0 4px;
  font-size: 11px;
}

.raw__rating {
  color: var(--color-primary);
  font-weight: 700;
}

.raw__outcome {
  color: var(--color-ink-mute);
}

.raw__body {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
}

.raw__empty {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}
</style>
