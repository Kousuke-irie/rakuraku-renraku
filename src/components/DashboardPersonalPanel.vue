<script setup>
// 監視ダッシュボードの「個人」タブ（P4-8 / monitoring.md §6-2）
//
// 全社タブが「取りこぼしが**どこに**あるか」を探す画面なのに対し、
// こちらは「**自分の持ち分**がいまどうなっているか」を見る画面。
// 母数は担当者1人ぶん（rooms.assignee_user_id）で、集計はサーバが1回で返す。
//
// ★担当者は切り替えられる。全社タブで担当者別の遵守率を全員に見せているのと
//   同じ理由（相互監視）で、ここだけ本人限定にはしない。
//
// ★全チャートに「表で見る」がある。canvas は読み上げできないため（ChartPanel 参照）。
import { computed, onMounted, ref, watch } from "vue"
import { Bar, Doughnut, Line } from "vue-chartjs"
import { dashboardApi, toErrorMessage, usersApi } from "../api/index.js"
import {
  AI_RECOMMENDED_PRIORITY,
  AI_RECOMMENDED_PRIORITY_META,
  AI_RECOMMENDED_PRIORITY_TITLE,
  HANDLING_STATUS,
  HANDLING_STATUS_META,
  HOURS_IN_DAY,
  HR_SURVEY_AXIS_META,
  HR_SURVEY_AXIS_VALUES,
  HR_SURVEY_RATING_MAX,
  REPLY_LATENCY_BUCKET,
  REPLY_STATE,
  ROLE,
  SELECTION_PHASE,
  SELECTION_PHASE_META,
  SELECTION_PHASE_VALUES,
} from "../constants/index.js"
import {
  BAR_STYLE,
  CHART_COLOR,
  DOUGHNUT_STYLE,
  LINE_STYLE,
  doughnutOptions,
  horizontalBarOptions,
  lineOptions,
  ratingBarOptions,
  verticalBarOptions,
} from "../plugins/charts.js"
import { useAuthStore } from "../stores/auth.js"
import { useUiStore } from "../stores/ui.js"
import ChartPanel from "./ChartPanel.vue"

// #region constants
/**
 * 対応ステータス5分類の配色。**ドーナツの並び順とセットで検証済み**
 * （charts.js の CHART_COLOR のコメント参照）。片方だけ変えないこと。
 */
const HANDLING_COLOR = {
  [HANDLING_STATUS.NEEDS_REPLY]: CHART_COLOR.HANDLING_NEEDS_REPLY,
  [HANDLING_STATUS.IN_PROGRESS]: CHART_COLOR.HANDLING_IN_PROGRESS,
  [HANDLING_STATUS.WAITING_STUDENT]: CHART_COLOR.HANDLING_WAITING_STUDENT,
  [HANDLING_STATUS.DONE]: CHART_COLOR.HANDLING_DONE,
  [HANDLING_STATUS.ON_HOLD]: CHART_COLOR.HANDLING_ON_HOLD,
}

/** AI推奨度は重大度3段。赤＝手を打つべき／橙＝様子見／青＝問題なし */
const AI_PRIORITY_COLOR = {
  [AI_RECOMMENDED_PRIORITY.HIGH]: CHART_COLOR.SEVERITY_HIGH,
  [AI_RECOMMENDED_PRIORITY.NORMAL]: CHART_COLOR.SEVERITY_MID,
  [AI_RECOMMENDED_PRIORITY.LOW]: CHART_COLOR.SEVERITY_LOW,
}

const REPLY_STATE_COLOR = {
  [REPLY_STATE.OVERDUE]: CHART_COLOR.SEVERITY_HIGH,
  [REPLY_STATE.WAITING]: CHART_COLOR.SEVERITY_MID,
  [REPLY_STATE.REPLIED]: CHART_COLOR.SEVERITY_LOW,
}

const PHASE_COLOR = {
  [SELECTION_PHASE.PRE]: CHART_COLOR.PHASE_PRE,
  [SELECTION_PHASE.IN_PROGRESS]: CHART_COLOR.PHASE_IN_PROGRESS,
  [SELECTION_PHASE.SETTLED]: CHART_COLOR.PHASE_SETTLED,
  [SELECTION_PHASE.EXITED]: CHART_COLOR.PHASE_EXITED,
}

/**
 * サーバが返す時刻は UTC。表示はローカルに直す（CLAUDE.md §6-2）。
 * 整数時間オフセットの地域なら配列の回転だけで無損失に変換できる。
 */
const LOCAL_OFFSET_HOURS = -Math.round(new Date().getTimezoneOffset() / 60)
// #endregion

// #region global state
const auth = useAuthStore()
const ui = useUiStore()
// #endregion

// #region local variable
/** @type {import('vue').Ref<object|null>} */
const data = ref(null)
const loading = ref(true)
/** @type {import('vue').Ref<Array<{id:number,displayName:string}>>} */
const assignees = ref([])
const selectedAssigneeId = ref(auth.user?.id ?? null)
// #endregion

// #region computed
const thresholds = computed(() => data.value?.thresholds ?? { notifyHours: 24, escalateHours: 48 })

const assigneeName = computed(() => data.value?.assignee?.displayName ?? "")

const isSelf = computed(() => data.value?.assignee?.id === auth.user?.id)

/** 総件数。ドーナツの割合表示の分母 */
const percentOf = (value, total) => (total === 0 ? 0 : Math.round((value / total) * 100))

const kpiTiles = computed(() => {
  const kpi = data.value?.kpi
  if (!kpi) return []

  return [
    { key: "assigned", label: "担当学生", value: `${kpi.assignedStudents}`, note: "自分に割り当てられた人数" },
    { key: "needsReply", label: "要返信", value: `${kpi.needsReply}`, note: "対応ステータスが要返信" },
    {
      key: "overdue",
      label: `${thresholds.value.notifyHours}時間超の未返信`,
      value: `${kpi.overdue}`,
      note: "学生を待たせている件数",
      alert: true,
    },
    {
      key: "median",
      label: "返信までの中央値",
      // 母数0のときに「0時間」と出すと「即返信できている」に見えるので明示的に伏せる
      value: kpi.replyMedianHours === null ? "—" : `${kpi.replyMedianHours}`,
      unit: kpi.replyMedianHours === null ? "" : "時間",
      note: "過去のやり取り全体",
    },
  ]
})

// --- ① 対応ステータス構成比 ---
// ★5分類のドーナツ。色だけでは要返信(赤)と完了(緑)が色覚多様性で潰れるため、
//   凡例に必ず件数と割合を出す（charts.js のコメント参照）。
const handlingRows = computed(() => data.value?.handlingBreakdown ?? [])
const handlingTotal = computed(() =>
  handlingRows.value.reduce((sum, row) => sum + row.count, 0),
)

const handlingChart = computed(() => ({
  labels: handlingRows.value.map((row) => HANDLING_STATUS_META[row.status]?.label ?? row.status),
  datasets: [
    {
      data: handlingRows.value.map((row) => row.count),
      backgroundColor: handlingRows.value.map((row) => HANDLING_COLOR[row.status]),
      ...DOUGHNUT_STYLE,
    },
  ],
}))

const handlingLegend = computed(() =>
  handlingRows.value.map((row) => ({
    label: HANDLING_STATUS_META[row.status]?.label ?? row.status,
    color: HANDLING_COLOR[row.status],
    value: `${row.count}件（${percentOf(row.count, handlingTotal.value)}%）`,
  })),
)

const handlingTableRows = computed(() =>
  handlingRows.value.map((row) => [
    HANDLING_STATUS_META[row.status]?.label ?? row.status,
    `${row.count}件`,
    `${percentOf(row.count, handlingTotal.value)}%`,
  ]),
)

// --- ② AI推奨度構成比 ---
const aiRows = computed(() => data.value?.aiPriorityBreakdown ?? [])
const aiTotal = computed(() => aiRows.value.reduce((sum, row) => sum + row.count, 0))

const aiChart = computed(() => ({
  labels: aiRows.value.map((row) => AI_RECOMMENDED_PRIORITY_META[row.priority]?.label ?? row.priority),
  datasets: [
    {
      data: aiRows.value.map((row) => row.count),
      backgroundColor: aiRows.value.map((row) => AI_PRIORITY_COLOR[row.priority]),
      ...DOUGHNUT_STYLE,
    },
  ],
}))

const aiLegend = computed(() =>
  aiRows.value.map((row) => ({
    label: AI_RECOMMENDED_PRIORITY_META[row.priority]?.label ?? row.priority,
    color: AI_PRIORITY_COLOR[row.priority],
    value: `${row.count}件（${percentOf(row.count, aiTotal.value)}%）`,
  })),
)

const aiTableRows = computed(() =>
  aiRows.value.map((row) => [
    AI_RECOMMENDED_PRIORITY_META[row.priority]?.label ?? row.priority,
    `${row.count}件`,
    `${percentOf(row.count, aiTotal.value)}%`,
    // AI が判定できなかったぶんは緊急度に落ちている。その内訳を出す
    `${row.aiCount}件`,
  ]),
)

// --- ③ 返信状況構成比 ---
// **対応ステータスとは別の軸。** 人が付けるステータスではなく、時刻から機械的に決まる
const replyStateLabel = computed(() => ({
  [REPLY_STATE.REPLIED]: "返信済み",
  [REPLY_STATE.WAITING]: `未返信（${thresholds.value.notifyHours}時間以内）`,
  [REPLY_STATE.OVERDUE]: `未返信（${thresholds.value.notifyHours}時間超）`,
}))

const replyStateRows = computed(() => data.value?.replyStateBreakdown ?? [])
const replyStateTotal = computed(() =>
  replyStateRows.value.reduce((sum, row) => sum + row.count, 0),
)

const replyStateChart = computed(() => ({
  labels: replyStateRows.value.map((row) => replyStateLabel.value[row.state]),
  datasets: [
    {
      data: replyStateRows.value.map((row) => row.count),
      backgroundColor: replyStateRows.value.map((row) => REPLY_STATE_COLOR[row.state]),
      ...DOUGHNUT_STYLE,
    },
  ],
}))

const replyStateLegend = computed(() =>
  replyStateRows.value.map((row) => ({
    label: replyStateLabel.value[row.state],
    color: REPLY_STATE_COLOR[row.state],
    value: `${row.count}件（${percentOf(row.count, replyStateTotal.value)}%）`,
  })),
)

const replyStateTableRows = computed(() =>
  replyStateRows.value.map((row) => [
    replyStateLabel.value[row.state],
    `${row.count}件`,
    `${percentOf(row.count, replyStateTotal.value)}%`,
  ]),
)

// --- ④ 選考ステータス別 ---
// 10段階を10色にしない。色が担うのは4区分（選考前／選考中／確定／離脱）だけ
//
// ★段階と並び、表示名はサーバが会社の選考フロー設定から決めて返す（P2-11）。
//   使っていない段階は含まれない。ここで SELECTION_STATUS_VALUES を並べ直さないこと。
const selectionRows = computed(() => data.value?.selectionBreakdown ?? [])

/** 標準フロー外の段階には印を付ける。設定を変えた後に取り残された学生がいるということ */
const selectionLabel = (row) =>
  row.isEnabled ? row.label : `${row.label}（フロー対象外）`

const selectionChart = computed(() => ({
  labels: selectionRows.value.map(selectionLabel),
  datasets: [
    {
      data: selectionRows.value.map((row) => row.count),
      backgroundColor: selectionRows.value.map((row) => PHASE_COLOR[row.phase] ?? CHART_COLOR.PRIMARY),
      ...BAR_STYLE,
    },
  ],
}))

const selectionLegend = SELECTION_PHASE_VALUES.map((phase) => ({
  label: SELECTION_PHASE_META[phase].label,
  color: PHASE_COLOR[phase],
}))

const selectionTableRows = computed(() =>
  selectionRows.value.map((row) => [
    selectionLabel(row),
    `${row.count}名`,
    SELECTION_PHASE_META[row.phase]?.label ?? row.phase,
  ]),
)

// --- ⑤ 時間帯別の返信タイミング ---
/**
 * サーバは UTC の時刻で返すので、ここでローカル時刻へ回す。
 * 0〜23時の並びは崩さない（横軸が時計と同じ順でないと読めない）。
 */
const hourly = computed(() => {
  const source = data.value?.hourlyActivity ?? []
  if (source.length === 0) return []

  return Array.from({ length: HOURS_IN_DAY }, (_, localHour) => {
    const utcHour = (localHour - LOCAL_OFFSET_HOURS + HOURS_IN_DAY * 2) % HOURS_IN_DAY
    const row = source[utcHour] ?? { hrCount: 0, studentCount: 0 }

    return { localHour, hrCount: row.hrCount, studentCount: row.studentCount }
  })
})

const hourlyTotals = computed(() => ({
  hr: hourly.value.reduce((sum, row) => sum + row.hrCount, 0),
  student: hourly.value.reduce((sum, row) => sum + row.studentCount, 0),
}))

/**
 * ★件数ではなく**各系列内の構成比**で描く。
 *   人事と学生では総メッセージ数が違うので、件数のまま重ねると
 *   「時間帯のずれ」ではなく「量の差」しか読めない。
 */
const share = (value, total) => (total === 0 ? 0 : Math.round((value / total) * 1000) / 10)

const hourlyChart = computed(() => ({
  labels: hourly.value.map((row) => `${row.localHour}時`),
  datasets: [
    {
      label: "人事の送信",
      data: hourly.value.map((row) => share(row.hrCount, hourlyTotals.value.hr)),
      borderColor: CHART_COLOR.ACTOR_HR,
      backgroundColor: CHART_COLOR.ACTOR_HR,
      pointStyle: "circle",
      ...LINE_STYLE,
    },
    {
      label: "学生の送信",
      data: hourly.value.map((row) => share(row.studentCount, hourlyTotals.value.student)),
      borderColor: CHART_COLOR.ACTOR_STUDENT,
      backgroundColor: CHART_COLOR.ACTOR_STUDENT,
      // 色に加えて線種と点の形でも区別する（CLAUDE.md §6-13）
      borderDash: [5, 4],
      pointStyle: "triangle",
      ...LINE_STYLE,
    },
  ],
}))

const hourlyLegend = computed(() => [
  {
    label: "人事の送信（実線・丸）",
    color: CHART_COLOR.ACTOR_HR,
    value: `${hourlyTotals.value.hr}件`,
  },
  {
    label: "学生の送信（破線・三角）",
    color: CHART_COLOR.ACTOR_STUDENT,
    value: `${hourlyTotals.value.student}件`,
    dash: true,
  },
])

const hourlyTableRows = computed(() =>
  hourly.value.map((row) => [
    `${row.localHour}時`,
    `${row.hrCount}件（${share(row.hrCount, hourlyTotals.value.hr)}%）`,
    `${row.studentCount}件（${share(row.studentCount, hourlyTotals.value.student)}%）`,
  ]),
)

// --- ⑥ 返信にかかった時間 ---
const latency = computed(
  () => data.value?.replyLatency ?? { buckets: [], medianHours: null, averageHours: null, sampleSize: 0 },
)

const bucketLabel = (key) => REPLY_LATENCY_BUCKET.find((bucket) => bucket.key === key)?.label ?? key

const latencyChart = computed(() => ({
  labels: latency.value.buckets.map((row) => bucketLabel(row.key)),
  datasets: [
    {
      data: latency.value.buckets.map((row) => row.count),
      backgroundColor: CHART_COLOR.PRIMARY,
      ...BAR_STYLE,
    },
  ],
}))

const latencyTableRows = computed(() =>
  latency.value.buckets.map((row) => [
    bucketLabel(row.key),
    `${row.count}件`,
    `${percentOf(row.count, latency.value.sampleSize)}%`,
  ]),
)

/** 中央値を主役にする。平均は夜間・週末をまたいだ数件で簡単に跳ねるため併記に留める */
const latencyNote = computed(() => {
  if (latency.value.sampleSize === 0) return "返信済みのやり取りがまだありません"

  const average = latency.value.averageHours

  return `返信済み${latency.value.sampleSize}件。中央値 ${latency.value.medianHours}時間（平均 ${average}時間）。学生が続けて送った場合は最初の1通からの時間で数えます`
})

// --- 学生からの評価（S-12） ---
const hrSurvey = computed(
  () =>
    data.value?.hrSurvey ?? {
      isSuppressed: true,
      minSampleSize: 3,
      count: 0,
      axisAverages: null,
      avgOverall: null,
      answerableCount: 0,
    }
)

/** 伏せている場合は rows を空にして、ChartPanel の empty-text に説明を出させる */
const hrSurveyRows = computed(() => {
  if (hrSurvey.value.isSuppressed) return []

  return HR_SURVEY_AXIS_VALUES.map((axis) => [
    HR_SURVEY_AXIS_META[axis].label,
    hrSurvey.value.axisAverages[axis] ?? "—",
  ])
})

const hrSurveyChart = computed(() => ({
  labels: HR_SURVEY_AXIS_VALUES.map((axis) => HR_SURVEY_AXIS_META[axis].label),
  datasets: [
    {
      data: HR_SURVEY_AXIS_VALUES.map((axis) => hrSurvey.value.axisAverages?.[axis] ?? 0),
      backgroundColor: CHART_COLOR.PRIMARY,
      ...BAR_STYLE,
    },
  ],
}))

const hrSurveyNote = computed(() => {
  const { count, answerableCount, avgOverall, isSuppressed } = hrSurvey.value
  const base = `内定・辞退が決まった担当学生 ${answerableCount}名中 ${count}件の回答`

  if (isSuppressed) return base
  return `${base}。総合 ${avgOverall} / ${HR_SURVEY_RATING_MAX}（3軸の平均）`
})

/** 伏せている理由は必ず書く。黙って空にすると「回答が0件」と読み違える */
const hrSurveyEmptyText = computed(() => {
  const { count, minSampleSize } = hrSurvey.value
  if (count === 0) return "回答はまだありません"

  return (
    `回答が${count}件で、${minSampleSize}件に満たないため表示していません。` +
    "回答者が特定できてしまうため、ご自身の担当ぶんでも同じ扱いです。"
  )
})
// #endregion

// #region local methods
const chartHeight = (count, min = 160) => Math.max(min, count * 26 + 40)

const load = async () => {
  loading.value = true
  try {
    const response = await dashboardApi.getPersonal(selectedAssigneeId.value)
    data.value = response.data
    // サーバが解決した担当者に合わせる（未指定で開いたときは自分が返る）
    selectedAssigneeId.value = response.data.assignee.id
  } catch (error) {
    ui.pushToast({
      type: "error",
      message: toErrorMessage(error, "ダッシュボードの取得に失敗しました"),
    })
  } finally {
    loading.value = false
  }
}

const loadAssignees = async () => {
  try {
    const response = await usersApi.list({ role: `${ROLE.HR},${ROLE.ADMIN}` })
    assignees.value = response.data.users
  } catch {
    // 候補が取れなくても自分ぶんの集計は出せるので、画面は止めない
    assignees.value = []
  }
}
// #endregion

// #region lifecycle
onMounted(async () => {
  await Promise.all([load(), loadAssignees()])
})

watch(selectedAssigneeId, (next, previous) => {
  if (next !== previous) load()
})
// #endregion
</script>

<template>
  <div class="personal">
    <header class="personal__head">
      <div>
        <p class="personal__note">
          <strong>{{ isSelf ? "自分" : assigneeName }}</strong>
          の担当ぶんの集計です。母数は担当している学生だけで、全社タブとは数字が一致しません。
        </p>
        <p class="personal__note">
          学生の最後の発言から <strong>{{ thresholds.notifyHours }}時間</strong> で担当者へ通知、
          <strong>{{ thresholds.escalateHours }}時間</strong> で上長へエスカレーションします。
        </p>
      </div>

      <div class="personal__controls">
        <label class="field">
          <span class="field__label">担当者</span>
          <select
            v-model.number="selectedAssigneeId"
            class="field__select"
            :disabled="loading || assignees.length === 0"
          >
            <option
              v-for="user in assignees"
              :key="user.id"
              :value="user.id"
            >
              {{ user.displayName }}{{ user.id === auth.user?.id ? "（自分）" : "" }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="chip"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? "更新中…" : "更新" }}
        </button>
      </div>
    </header>

    <!-- KPI：数字そのものが答えなのでグラフにしない（全社タブと同じ方針） -->
    <ul class="kpi">
      <li
        v-for="tile in kpiTiles"
        :key="tile.key"
        class="kpi__tile"
        :class="{ 'kpi__tile--alert': tile.alert && Number(tile.value) > 0 }"
      >
        <p class="kpi__label">
          {{ tile.label }}
        </p>
        <p class="kpi__value">
          {{ tile.value }}<span
            v-if="tile.unit"
            class="kpi__unit"
          >{{ tile.unit }}</span>
        </p>
        <p class="kpi__note">
          {{ tile.note }}
        </p>
      </li>
    </ul>

    <!-- 構成比の3枚。並べて見ることで「どのステータスが、どれだけ待たされているか」が読める -->
    <div class="grid grid--three">
      <ChartPanel
        title="対応ステータスの構成比"
        note="自分が付けた処理状態の内訳"
        :columns="['対応ステータス', '件数', '割合']"
        :rows="handlingTableRows"
        :legend="handlingLegend"
        :height="200"
      >
        <Doughnut
          :data="handlingChart"
          :options="doughnutOptions()"
        />
      </ChartPanel>

      <ChartPanel
        :title="`${AI_RECOMMENDED_PRIORITY_TITLE}の構成比`"
        note="受信箱の並び順と同じ判定。AIが判定できなかったぶんは緊急度で代替します"
        :columns="[AI_RECOMMENDED_PRIORITY_TITLE, '件数', '割合', 'うちAI判定']"
        :rows="aiTableRows"
        :legend="aiLegend"
        :height="200"
      >
        <Doughnut
          :data="aiChart"
          :options="doughnutOptions()"
        />
      </ChartPanel>

      <ChartPanel
        title="返信状況の構成比"
        note="学生の最後の発言に返したかどうかを時刻から判定します。対応ステータスとは別の軸です"
        :columns="['返信状況', '件数', '割合']"
        :rows="replyStateTableRows"
        :legend="replyStateLegend"
        :height="200"
      >
        <Doughnut
          :data="replyStateChart"
          :options="doughnutOptions()"
        />
      </ChartPanel>
    </div>

    <div class="grid">
      <ChartPanel
        title="選考ステータス別 担当学生数"
        note="担当している学生のみ。選考フローの設定で有効な段階を、その並び順で表示します"
        :columns="['選考ステータス', '人数', '区分']"
        :rows="selectionTableRows"
        :legend="selectionLegend"
        :height="chartHeight(selectionTableRows.length, 260)"
      >
        <Bar
          :data="selectionChart"
          :options="horizontalBarOptions()"
        />
      </ChartPanel>

      <ChartPanel
        title="返信にかかった時間の分布"
        :note="latencyNote"
        :columns="['所要時間', '件数', '割合']"
        :rows="latency.sampleSize === 0 ? [] : latencyTableRows"
        empty-text="返信済みのやり取りがまだありません"
        :height="260"
      >
        <Bar
          :data="latencyChart"
          :options="verticalBarOptions()"
        />
      </ChartPanel>
    </div>

    <!-- 2系列を1本の軸に重ねる。人事と学生で軸を分けるとずれが読めなくなる -->
    <ChartPanel
      title="時間帯別の送信タイミング"
      note="各系列内の構成比。人事と学生で総数が違うため件数では比較できません。時刻はお使いの端末のタイムゾーンです"
      :columns="['時間帯', '人事の送信', '学生の送信']"
      :rows="hourlyTotals.hr + hourlyTotals.student === 0 ? [] : hourlyTableRows"
      empty-text="メッセージがまだありません"
      :legend="hourlyLegend"
      :height="280"
    >
      <Line
        :data="hourlyChart"
        :options="lineOptions()"
      />
    </ChartPanel>

    <!--
      人事FBアンケート（S-12）。**下限未満なら数字を出さない。**
      本人が自分のぶんを見る場合も同じ。「自分ならよい」にすると、担当者は
      誰が答えたか分かる状態で読むことになり、学生への約束が崩れる。
    -->
    <ChartPanel
      title="学生からの評価（選考終了後アンケート）"
      :note="hrSurveyNote"
      :columns="['評価軸', '平均']"
      :rows="hrSurveyRows"
      :empty-text="hrSurveyEmptyText"
      :height="180"
    >
      <Bar
        :data="hrSurveyChart"
        :options="ratingBarOptions(HR_SURVEY_RATING_MAX)"
      />
    </ChartPanel>
  </div>
</template>

<style scoped>
.personal__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.personal__note {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.personal__controls {
  display: flex;
  flex: none;
  gap: var(--space-md);
  align-items: center;
}

.field {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.field__label {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.field__select {
  padding: 6px 12px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 13px;
}

/* --- KPI --- */
.kpi {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-md);
  margin: 0 0 var(--space-lg);
  padding: 0;
  list-style: none;
}

.kpi__tile {
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
}

/* 学生を待たせている件数が残っているときだけ強調する */
.kpi__tile--alert {
  border-color: var(--color-sla-alert);
  background-color: var(--color-orange-soft);
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

.kpi__unit {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 600;
}

.kpi__note {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

/* --- チャート --- */
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* 3枚並びは幅が足りなくなるとドーナツが潰れるので、先に2枚＋1枚へ落とす */
@media (width < 1200px) {
  .grid--three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
