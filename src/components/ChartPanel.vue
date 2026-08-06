<script setup>
// P4-4: チャート1枚ぶんの枠。タイトル・チャート本体・「表で見る」トグルをまとめる。
//
// ★テーブル表示は任意ではない。
//   Chart.js は canvas に描くので DOM が無く、スクリーンリーダーから読めない。
//   全チャートに表を用意することが、色だけで情報を伝えない（CLAUDE.md §6-13）の
//   実現手段でもある（monitoring.md §6）。
import { ref } from "vue"

defineProps({
  title: { type: String, required: true },
  /** 補足（母数の説明など）。無ければ出さない */
  note: { type: String, default: "" },
  /** テーブルの列見出し */
  columns: { type: Array, required: true },
  /** テーブルの行。columns と同じ順の配列の配列 */
  rows: { type: Array, required: true },
  /** データが1件も無いときの文言 */
  emptyText: { type: String, default: "データがありません" },
  /**
   * 凡例。**色が2種類以上あるチャートには必ず渡すこと。**
   * `[{ label, color }]`。Chart.js の Legend は使わず HTML で描く
   * （canvas 内だと読み上げできないため。ChartPanel の趣旨と同じ）。
   */
  legend: { type: Array, default: () => [] },
  /** チャートの高さ（px）。行数で変わるので呼び出し側が決める */
  height: { type: Number, default: 220 },
})

// #region local variable
const showTable = ref(false)
// #endregion
</script>

<template>
  <section class="panel">
    <header class="panel__head">
      <div>
        <h2 class="panel__title">
          {{ title }}
        </h2>
        <p
          v-if="note"
          class="panel__note"
        >
          {{ note }}
        </p>
      </div>
      <button
        type="button"
        class="chip panel__toggle"
        :aria-pressed="showTable"
        @click="showTable = !showTable"
      >
        {{ showTable ? "グラフで見る" : "表で見る" }}
      </button>
    </header>

    <p
      v-if="rows.length === 0"
      class="panel__empty"
    >
      {{ emptyText }}
    </p>

    <div
      v-else-if="showTable"
      class="panel__table-wrap"
    >
      <table class="table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column"
              scope="col"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="index"
          >
            <td
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-else>
      <!-- 凡例は canvas の外に HTML で置く。色の隣に必ずテキストを添えるので、
           色が判別できなくても意味が取れる（CLAUDE.md §6-13） -->
      <ul
        v-if="legend.length > 0"
        class="legend"
      >
        <li
          v-for="item in legend"
          :key="item.label"
          class="legend__item"
        >
          <span
            class="legend__swatch"
            :style="{ backgroundColor: item.color }"
            aria-hidden="true"
          />
          {{ item.label }}
        </li>
      </ul>

      <div
        class="panel__chart"
        :style="{ height: `${height}px` }"
      >
        <slot />
      </div>
    </template>
  </section>
</template>

<style scoped>
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
  gap: var(--space-md);
  align-items: flex-start;
  justify-content: space-between;
}

.panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

/* タイトルが長いと押し潰されて「表で見 る」と折り返すので縮ませない */
.panel__toggle {
  flex: none;
  white-space: nowrap;
}

.panel__note {
  margin: 2px 0 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.panel__chart {
  position: relative;
  min-width: 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.legend__item {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.legend__swatch {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-xs);
}

.panel__empty {
  margin: 0;
  padding: var(--space-xl) 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  text-align: center;
}

/* 横に長い表は枠内でスクロールさせる。ページ全体を横スクロールさせない */
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
</style>
