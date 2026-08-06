<script setup>
// 監視ダッシュボード（P4-4 / monitoring.md §6）
//
// 閲覧は人事全員（hr / admin）。担当者別の集計も共有する。**相互監視のため**で、
// 隠すと「取りこぼしの拾い上げ」が個人の努力に戻ってしまう。
// 学生には出さない（ルーターガードとサーバ側の requireHr の両方で弾く）。
//
// ★受信箱のサマリーバー（P1-8）と数字が重なる部分があるが、
//   こちらは**全社**が母数。ラベルに明記して混同を避ける。
//
// ★全チャートに「表で見る」がある。canvas は読み上げできないため（ChartPanel 参照）。
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { Bar } from "vue-chartjs"
import { dashboardApi, toErrorMessage } from "../api/index.js"
import {
  ALERT_KIND_META,
  ALERT_KIND,
  COMPLIANCE_CATEGORY_META,
  SELECTION_PHASE,
  SELECTION_PHASE_META,
  SELECTION_PHASE_VALUES,
  SELECTION_STATUS_META,
} from "../constants/index.js"
import {
  BAR_STYLE,
  CHART_COLOR,
  STACKED_BAR_STYLE,
  horizontalBarOptions,
  stackedBarOptions,
  verticalBarOptions,
} from "../plugins/charts.js"
import { useUiStore } from "../stores/ui.js"
import ChartPanel from "../components/ChartPanel.vue"

// #region global state
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()
/** @type {import('vue').Ref<object|null>} */
const data = ref(null)
const loading = ref(true)
// #endregion

// #region computed
const thresholds = computed(() => data.value?.thresholds ?? { notifyHours: 24, escalateHours: 48 })

const kpiTiles = computed(() => {
  const kpi = data.value?.kpi
  if (!kpi) return []

  return [
    { key: "needsReply", label: "要返信（全社）", value: kpi.needsReply, note: "未返信の学生" },
    {
      key: "overdue24h",
      label: `${thresholds.value.notifyHours}時間超`,
      value: kpi.overdue24h,
      note: "担当者へ通知済み",
    },
    {
      key: "escalated",
      label: "上長対応中",
      value: kpi.escalated,
      note: `${thresholds.value.escalateHours}時間超`,
      alert: true,
    },
    {
      key: "compliance",
      label: "今週の警告",
      value: kpi.complianceThisWeek,
      note: "コンプライアンス検知",
    },
  ]
})

// --- ② 選考ステータス別 ---
// 10段階を10色にしない。段階の違いはバーの位置が示すので色に仕事はない。
// 色が担うのは**4区分**（選考前／選考中／確定／離脱）だけ。
//
// ★「確定＝緑」にはできない。バーの並びで確定(内定)と離脱(辞退)が隣接するため、
//   緑と赤を当てると P型・D型色覚で潰れる（実測 CVD ΔE 5.2）。紫を当てている。
//   採用した4色は全項目 PASS（隣接 CVD 15.0 / 通常視 17.7）。
const PHASE_COLOR = {
  [SELECTION_PHASE.PRE]: CHART_COLOR.PHASE_PRE,
  [SELECTION_PHASE.IN_PROGRESS]: CHART_COLOR.PHASE_IN_PROGRESS,
  [SELECTION_PHASE.SETTLED]: CHART_COLOR.PHASE_SETTLED,
  [SELECTION_PHASE.EXITED]: CHART_COLOR.PHASE_EXITED,
}

const selectionChart = computed(() => {
  const rows = data.value?.selectionBreakdown ?? []

  return {
    labels: rows.map((row) => SELECTION_STATUS_META[row.status]?.label ?? row.status),
    datasets: [
      {
        data: rows.map((row) => row.count),
        backgroundColor: rows.map((row) => PHASE_COLOR[row.phase] ?? CHART_COLOR.PRIMARY),
        ...BAR_STYLE,
      },
    ],
  }
})

/** 凡例は4区分ぶん。色の隣に必ず区分名を置く */
const selectionLegend = SELECTION_PHASE_VALUES.map((phase) => ({
  label: SELECTION_PHASE_META[phase].label,
  color: PHASE_COLOR[phase],
}))

const selectionRows = computed(() =>
  (data.value?.selectionBreakdown ?? []).map((row) => [
    SELECTION_STATUS_META[row.status]?.label ?? row.status,
    `${row.count}名`,
    SELECTION_PHASE_META[row.phase]?.label ?? row.phase,
  ]),
)

// --- ③ 担当者別 SLA ---
const slaSegments = computed(() => [
    { key: "within", label: `${thresholds.value.notifyHours}時間以内`, color: CHART_COLOR.SLA_WITHIN },
    {
      key: "over24h",
      label: `${thresholds.value.notifyHours}〜${thresholds.value.escalateHours}時間`,
      color: CHART_COLOR.SLA_OVER_24H,
    },
  { key: "over48h", label: `${thresholds.value.escalateHours}時間超`, color: CHART_COLOR.SLA_OVER_48H },
])

const slaLegend = computed(() =>
  slaSegments.value.map((segment) => ({ label: segment.label, color: segment.color })),
)

const slaChart = computed(() => {
  const rows = data.value?.slaByAssignee ?? []

  return {
    labels: rows.map((row) => row.displayName),
    datasets: slaSegments.value.map((segment) => ({
      label: segment.label,
      data: rows.map((row) => row[segment.key]),
      backgroundColor: segment.color,
      ...STACKED_BAR_STYLE,
    })),
  }
})

const slaRows = computed(() =>
  (data.value?.slaByAssignee ?? []).map((row) => [
    row.displayName,
    `${row.within}件`,
    `${row.over24h}件`,
    `${row.over48h}件`,
  ]),
)

// --- ④ 発生推移 ---
const trendChart = computed(() => {
  const rows = data.value?.slaTrend ?? []

  return {
    labels: rows.map((row) => row.date.slice(5).replace("-", "/")),
    datasets: [
      { data: rows.map((row) => row.count), backgroundColor: CHART_COLOR.PRIMARY, ...BAR_STYLE },
    ],
  }
})

const trendRows = computed(() =>
  (data.value?.slaTrend ?? []).map((row) => [row.date, `${row.count}件`]),
)

// --- ⑤ コンプライアンス内訳 ---
// **ルールコード（honseki 等）を画面に出さない。** サーバが日本語ラベルを添えて返す
const complianceChart = computed(() => {
  const rows = data.value?.complianceBreakdown ?? []

  return {
    labels: rows.map((row) => row.label),
    datasets: [
      { data: rows.map((row) => row.count), backgroundColor: CHART_COLOR.PRIMARY, ...BAR_STYLE },
    ],
  }
})

const complianceRows = computed(() =>
  (data.value?.complianceBreakdown ?? []).map((row) => [
    row.label,
    COMPLIANCE_CATEGORY_META[row.category]?.label ?? '—',
    `${row.count}件`,
    // 辞書だけでは届かず AI が拾った件数。AI 層の効き具合が分かる
    row.aiCount > 0 ? `${row.aiCount}件` : '—',
  ]),
)

const escalations = computed(() => data.value?.escalations ?? [])
// #endregion

// #region local methods
const chartHeight = (count, min = 160) => Math.max(min, count * 26 + 40)

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const load = async () => {
  loading.value = true
  try {
    const response = await dashboardApi.get()
    data.value = response.data
  } catch (error) {
    ui.pushToast({ type: "error", message: toErrorMessage(error, "ダッシュボードの取得に失敗しました") })
  } finally {
    loading.value = false
  }
}
// #endregion

// #region lifecycle
onMounted(load)
// #endregion

// #region browser event handler
const onOpenRoom = (roomId) => router.push(`/inbox/${roomId}`)
// #endregion
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__head">
      <div>
        <h1 class="dashboard__title">
          監視ダッシュボード
        </h1>
        <p class="dashboard__note">
          全社の対応状況です。互いの状況を確認できるよう、人事全員に公開しています。
        </p>
        <!-- 「SLA」という略語は画面に出さない。何時間で何が起きるかを直接書く -->
        <p class="dashboard__note">
          学生の最後の発言から <strong>{{ thresholds.notifyHours }}時間</strong> で担当者へ通知、
          <strong>{{ thresholds.escalateHours }}時間</strong> で上長へエスカレーションします。
        </p>
      </div>
      <button
        type="button"
        class="chip"
        :disabled="loading"
        @click="load"
      >
        {{ loading ? "更新中…" : "更新" }}
      </button>
    </header>

    <!-- ① KPI：数字そのものが答えなのでグラフにしない -->
    <ul class="kpi">
      <li
        v-for="tile in kpiTiles"
        :key="tile.key"
        class="kpi__tile"
        :class="{ 'kpi__tile--alert': tile.alert && tile.value > 0 }"
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
        title="選考ステータス別 学生数"
        note="全学生。進行順に並べています"
        :columns="['選考ステータス', '人数', '区分']"
        :rows="selectionRows"
        :legend="selectionLegend"
        :height="chartHeight(selectionRows.length, 260)"
      >
        <Bar
          :data="selectionChart"
          :options="horizontalBarOptions()"
        />
      </ChartPanel>

      <ChartPanel
        :title="`担当者別 返信状況（返信期限 ${thresholds.notifyHours}時間）`"
        note="学生の最後の発言からの経過時間で数えます。返信済み・完了・保留は「期限内」に含みます"
        :legend="slaLegend"
        :columns="['担当者', `${thresholds.notifyHours}時間以内`, `${thresholds.notifyHours}〜${thresholds.escalateHours}時間`, `${thresholds.escalateHours}時間超`]"
        :rows="slaRows"
        :height="chartHeight(slaRows.length, 260)"
      >
        <Bar
          :data="slaChart"
          :options="stackedBarOptions()"
        />
      </ChartPanel>

      <ChartPanel
        title="返信遅れ通知の発生推移"
        :note="`学生の発言から${thresholds.notifyHours}時間を超えた件数。直近14日・日別`"
        :columns="['日付', '発生件数']"
        :rows="trendRows"
        :height="220"
      >
        <Bar
          :data="trendChart"
          :options="verticalBarOptions()"
        />
      </ChartPanel>

      <ChartPanel
        title="コンプライアンス検知の内訳"
        note="ルール別の累計。「AI検知」は辞書では拾えず AI が見つけた件数です"
        :columns="['ルール', '分類', '件数', 'うちAI検知']"
        :rows="complianceRows"
        empty-text="検知はまだありません"
        :height="chartHeight(complianceRows.length)"
      >
        <Bar
          :data="complianceChart"
          :options="horizontalBarOptions()"
        />
      </ChartPanel>
    </div>

    <!-- 他社ツールに無い指標。この機能の価値はここに出る -->
    <p class="ignored">
      <span class="ignored__label">警告を無視して送信</span>
      <span class="ignored__value">{{ data?.complianceIgnored ?? 0 }}</span>
      <span class="ignored__unit">件</span>
    </p>

    <section class="panel">
      <header class="panel__head">
        <h2 class="panel__title">
          {{ ALERT_KIND_META[ALERT_KIND.SLA_ESCALATE].label }}中の案件
        </h2>
        <p class="panel__note">
          経過時間の長い順。行をクリックするとトークが開きます
        </p>
      </header>

      <p
        v-if="escalations.length === 0"
        class="panel__empty"
      >
        エスカレーション中の案件はありません。
      </p>

      <div
        v-else
        class="panel__table-wrap"
      >
        <table class="table">
          <thead>
            <tr>
              <th scope="col">
                学生
              </th>
              <th scope="col">
                担当者
              </th>
              <th scope="col">
                選考
              </th>
              <th scope="col">
                経過
              </th>
              <th scope="col">
                発生日時
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in escalations"
              :key="row.roomId"
              class="table__row"
              tabindex="0"
              @click="onOpenRoom(row.roomId)"
              @keydown.enter="onOpenRoom(row.roomId)"
            >
              <td>{{ row.studentName }}</td>
              <td>{{ row.assigneeName ?? "未配属" }}</td>
              <td>{{ SELECTION_STATUS_META[row.selectionStatus]?.label ?? "—" }}</td>
              <td>{{ row.elapsedHours === null ? "—" : `${Math.floor(row.elapsedHours)}時間` }}</td>
              <td>{{ formatDateTime(row.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  height: 100%;
  overflow-y: auto;
  padding: var(--space-xs) var(--space-lg) var(--space-xxl);
}

.dashboard__head {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.dashboard__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.dashboard__note {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
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

/* 上長が対応すべき案件が残っているときだけ強調する */
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

/* --- 無視して送信 --- */
.ignored {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
  margin: 0 0 var(--space-md);
  padding: var(--space-md) var(--space-xl);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
}

.ignored__label {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.ignored__value {
  font-size: 22px;
  font-weight: 700;
}

.ignored__unit {
  font-size: 12px;
}

/* --- エスカレーション表 --- */
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
}

.panel__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  align-items: baseline;
  justify-content: space-between;
}

.panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.panel__note {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.panel__empty {
  margin: 0;
  padding: var(--space-xl) 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  text-align: center;
}

.panel__table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.table th,
.table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-hairline);
  text-align: left;
  white-space: nowrap;
}

.table th {
  color: var(--color-ink-mute);
  font-weight: 600;
}

.table__row {
  cursor: pointer;
}

.table__row:hover,
.table__row:focus-visible {
  background-color: var(--color-orange-soft);
}

.legend {
  margin: var(--space-md) 0 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.legend__item + .legend__item::before {
  content: "／";
}
</style>
