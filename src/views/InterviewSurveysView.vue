<script setup>
// 面接アンケート（S-11）。学生が面接ステップごとに答えた★と自由記述を人事が読む。
//
// ★監視ダッシュボード（/dashboard）とは別ページ。
//   あちらは「人事の対応に取りこぼしがないか」を探す画面で、母数はルームと通知。
//   こちらは「面接官の面接が学生にどう受け取られたか」で、母数は学生の回答。
//   主語も次に取る行動も違うため、同じ画面に混ぜると問いが二重になる。
//
// ★この画面に「誰が書いたか」は出ない。サーバが返していない（api/interviewSurveys.js）。
//   「合否には影響しません」と約束して集めた回答なので、辿れる経路を作らない。
//   回答が少ない面接官の自由記述もサーバ側で落ちる。ここで絞り込まないこと。
//
// 構成は2段。
//   上 … 面接官どうしを**比べる**（横棒。常に全員を出す）
//   下 … 1つのスコープを**読む**（ドロップダウンで全体／面接官を切り替える）
// 棒グラフをドロップダウンに連動させない。比較が目的の図から比較対象を消してしまう。
import { computed, onMounted, ref, watch } from "vue"
import { Bar } from "vue-chartjs"
import { interviewSurveysApi, toErrorMessage } from "../api/index.js"
import {
  AI_SUMMARY_STATUS,
  INTERVIEW_SURVEY_RATING_MAX,
  INTERVIEW_SURVEY_RATING_MIN,
  INTERVIEW_SURVEY_SCOPE_ALL,
} from "../constants/index.js"
import { BAR_STYLE, CHART_COLOR, ratingBarOptions } from "../plugins/charts.js"
import { useUiStore } from "../stores/ui.js"
import ChartPanel from "../components/ChartPanel.vue"

// #region constants
const TITLE = "面接アンケート"
const FETCH_ERROR = "面接アンケートの取得に失敗しました"
/** 1行の高さ。面接官が増えてもバーの太さが変わらないようにする */
const ROW_HEIGHT = 46
const MIN_CHART_HEIGHT = 180
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
/** @type {import('vue').Ref<object|null>} GET /interview-surveys の結果 */
const data = ref(null)
/** @type {import('vue').Ref<object|null>} 選択スコープの自由記述 */
const commentData = ref(null)
/** @type {import('vue').Ref<object|null>} 選択スコープのAI要約 */
const summary = ref(null)

const scopeId = ref(INTERVIEW_SURVEY_SCOPE_ALL)
const loading = ref(true)
const textLoading = ref(false)
// #endregion

// #region computed
const interviewers = computed(() => data.value?.interviewers ?? [])
const overall = computed(() => data.value?.overall ?? { count: 0, avgRating: null })
const suppressed = computed(
  () => data.value?.suppressed ?? { interviewerCount: 0, responseCount: 0 }
)
const minSampleSize = computed(() => data.value?.minSampleSize ?? 3)

/** 回答率。分母は「完了済みの面接ステップ」の総数（サーバが数える） */
const answerRate = computed(() => {
  const answerable = data.value?.answerableCount ?? 0
  if (answerable === 0) return null
  return Math.round((overall.value.count / answerable) * 100)
})

const kpiTiles = computed(() => [
  {
    key: "count",
    label: "回答数",
    value: overall.value.count,
    note: `回答できる面接 ${data.value?.answerableCount ?? 0} 件中`,
  },
  {
    key: "rate",
    label: "回答率",
    value: answerRate.value === null ? "—" : `${answerRate.value}%`,
    note: "完了した面接に対する割合",
  },
  {
    key: "avg",
    label: "全体の平均満足度",
    value: overall.value.avgRating === null ? "—" : overall.value.avgRating,
    note: `${INTERVIEW_SURVEY_RATING_MAX}点満点。伏せた回答も含む`,
  },
])

// --- 面接官別 平均満足度 ---
// 単一系列なので単一色。段階ではなく「同じ指標の値どうし」を比べる図で、
// 色に持たせる意味が無い（凡例も付けない＝ChartPanel の legend を渡さない）。
//
// 母数はラベルに添える。★4.5（2件）と★4.0（30件）を同じ強さで読ませないため。
const barLabel = (row) => `${row.displayName}（${row.count}件）`

const ratingChart = computed(() => ({
  labels: interviewers.value.map(barLabel),
  datasets: [
    {
      data: interviewers.value.map((row) => row.avgRating),
      backgroundColor: CHART_COLOR.PRIMARY,
      ...BAR_STYLE,
    },
  ],
}))

/** 「表で見る」用。★の内訳まで出す（グラフでは平均しか読めないため） */
const ratingRows = computed(() =>
  interviewers.value.map((row) => [
    row.displayName,
    row.department ?? "—",
    row.count,
    row.avgRating,
    row.ratingBreakdown
      .map((n, index) => `★${index + INTERVIEW_SURVEY_RATING_MIN}:${n}`)
      .join(" "),
  ])
)

const chartHeight = computed(() =>
  Math.max(MIN_CHART_HEIGHT, interviewers.value.length * ROW_HEIGHT + 40)
)

/** 伏せた面接官がいることは隠さない。数字が合わないと集計そのものが信用されない */
const suppressedNote = computed(() => {
  const { interviewerCount, responseCount } = suppressed.value
  if (interviewerCount === 0) return ""

  return (
    `回答が${minSampleSize.value}件に満たない面接官${interviewerCount}名（計${responseCount}件）は、` +
    "回答者が特定できてしまうため個別に表示していません。上の全体の数字には含まれています。"
  )
})

// --- 自由記述 ---
const scopeOptions = computed(() => [
  { value: INTERVIEW_SURVEY_SCOPE_ALL, label: "全体" },
  ...interviewers.value.map((row) => ({ value: row.id, label: row.displayName })),
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
    return `回答が${minSampleSize.value}件に満たないため、この面接官のご意見は表示していません。`
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
async function fetchSummaryData() {
  loading.value = true
  try {
    const { data: payload } = await interviewSurveysApi.get()
    data.value = payload
  } catch (error) {
    ui.pushToast({ type: "error", message: toErrorMessage(error, FETCH_ERROR) })
  } finally {
    loading.value = false
  }
}

/**
 * 選択スコープの原文とAI要約。
 * 原文を先に描き、要約は後から差し込む（要約待ちで読み始められないのを避ける）。
 */
async function fetchTextData(force = false) {
  textLoading.value = true
  summary.value = { status: AI_SUMMARY_STATUS.LOADING }

  try {
    const { data: payload } = await interviewSurveysApi.comments(scopeId.value)
    commentData.value = payload
  } catch (error) {
    commentData.value = null
    ui.pushToast({ type: "error", message: toErrorMessage(error, FETCH_ERROR) })
  } finally {
    textLoading.value = false
  }

  try {
    const { data: payload } = await interviewSurveysApi.aiSummary(scopeId.value, { force })
    summary.value = payload
  } catch (error) {
    summary.value = {
      status: AI_SUMMARY_STATUS.ERROR,
      error: toErrorMessage(error, "要約を生成できませんでした"),
    }
  }
}
// #endregion

// #region browser event handler
const onRefresh = async () => {
  await fetchSummaryData()
  await fetchTextData(true)
}
// #endregion

// #region lifecycle
onMounted(async () => {
  await fetchSummaryData()
  await fetchTextData()
})

// ドロップダウンを変えたら原文と要約を取り直す。
// ★絞り込みを画面側でやらない（回答の少ない面接官の本文がクライアントに届いてしまう）
watch(scopeId, () => {
  void fetchTextData()
})
// #endregion
</script>

<template>
  <div class="surveys">
    <header class="surveys__head">
      <div>
        <h1 class="surveys__title">
          {{ TITLE }}
        </h1>
        <p class="surveys__lead">
          学生が面接後に回答した満足度とご意見です。<strong>回答者は表示されません。</strong>
        </p>
      </div>
      <button
        type="button"
        class="chip"
        :disabled="loading"
        @click="onRefresh"
      >
        {{ loading ? "更新中…" : "更新" }}
      </button>
    </header>

    <!-- 数字そのものが答えなのでグラフにしない -->
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

    <ChartPanel
      title="面接官別 平均満足度"
      :note="`${INTERVIEW_SURVEY_RATING_MAX}点満点。かっこ内は回答数で、少ないほど平均は振れます`"
      :columns="['面接官', '部署', '回答数', '平均', '★の内訳']"
      :rows="ratingRows"
      empty-text="表示できる回答がまだありません"
      :height="chartHeight"
    >
      <Bar
        :data="ratingChart"
        :options="ratingBarOptions(INTERVIEW_SURVEY_RATING_MAX)"
      />
    </ChartPanel>

    <p
      v-if="suppressedNote"
      class="surveys__suppressed"
    >
      {{ suppressedNote }}
    </p>

    <section class="panel">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">
            ご意見のまとめ
          </h2>
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
            <h3 class="summary__heading summary__heading--good">
              よかった点
            </h3>
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
            <h3 class="summary__heading summary__heading--bad">
              気になった点
            </h3>
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
        <h3 class="raw__title">
          回答の原文（{{ comments.length }}件）
        </h3>
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
              <span class="raw__rating">★{{ comment.rating }}</span>
              <span class="raw__step">{{ comment.stepLabel }}</span>
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
  </div>
</template>

<style scoped>
.surveys {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-xl);
  overflow-y: auto;
}

.surveys__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.surveys__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.surveys__lead {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.surveys__suppressed {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border-left: 3px solid var(--color-hairline);
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.7;
}

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
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
}

.kpi__label {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.kpi__value {
  margin: var(--space-xs) 0 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.kpi__note {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.panel {
  padding: var(--space-lg);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
}

.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.panel__note {
  margin: 2px 0 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.scope {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
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

.raw__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  max-height: 420px;
  overflow-y: auto;
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

.raw__step {
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
