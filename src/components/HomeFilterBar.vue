<script setup>
// ホームのフィルタ＆ソート行（S-07・frontend.md §5-2）
//
// ★このコンポーネントは**表示専用のガワ**である。
//   絞り込みの実体（roomsStore.filteredRooms / sortedRooms / applyFilters）が
//   まだ空実装なので、押しても効かないボタンを活性にしない。
//   P1-7 で FilterBar.vue に実装が入ったら、このファイルは削除して
//   FilterBar.vue をホームでも使い回すこと（フィルタ状態は roomsStore.filters で共有され、
//   ホームと受信箱で同じ絞り込みが効くようにする）。
import {
  HANDLING_STATUS_META,
  SELECTION_STATUS_META,
  TOPIC_TAG_META,
  URGENCY_META,
} from "../constants/index.js"

// #region constants
/**
 * 絞り込みの種別。ラベルは *_META の1件目から取るのではなく、
 * 種別そのものの名前なので固定文字列で持つ（列挙値そのものではないため直書きしてよい）。
 * meta を添えているのは、P1-7 で選択肢を展開するときの参照先を明示するため。
 */
const FILTERS = Object.freeze([
  { key: "handlingStatus", label: "対応", meta: HANDLING_STATUS_META },
  { key: "selectionStatus", label: "選考", meta: SELECTION_STATUS_META },
  { key: "topicTag", label: "タグ", meta: TOPIC_TAG_META },
  { key: "urgency", label: "緊急度", meta: URGENCY_META },
])

const DISABLED_HINT = "絞り込みは P1-7 で実装予定です"
// #endregion
</script>

<template>
  <div class="filter-bar">
    <span class="filter-bar__caption">フィルター</span>

    <button
      v-for="filter in FILTERS"
      :key="filter.key"
      type="button"
      class="filter-bar__chip"
      :title="DISABLED_HINT"
      disabled
    >
      {{ filter.label }}
      <span aria-hidden="true">▾</span>
    </button>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}

.filter-bar__caption {
  color: var(--color-ink-mute);
  font-size: 12px;
  font-weight: 700;
}

.filter-bar__chip {
  display: inline-flex;
  gap: var(--space-xs);
  align-items: center;
  padding: 5px 12px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
  font-size: 12px;
  font-weight: 600;
}

</style>
