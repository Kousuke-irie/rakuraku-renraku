<script setup>
// フィルタ・ソート UI（P1-7・frontend.md §5/§9）
// まずは選考ステータスの絞り込みのみ実装。対応ステータス・用件タグ・緊急度・担当者・
// ソート・「自分の担当のみ」トグルは次のステップ以降で追加する。
import { computed, ref } from "vue"
import { SELECTION_STATUS_META, SELECTION_STATUS_VALUES } from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"

const rooms = useRoomsStore()

const menuOpen = ref(false)

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
}

const isChecked = (status) => rooms.filters.selectionStatus.includes(status)

/** チェックのたびに即座に絞り込みへ反映する（requirements.md P1-7） */
const toggleStatus = (status) => {
  const current = rooms.filters.selectionStatus
  const next = isChecked(status)
    ? current.filter((value) => value !== status)
    : [...current, status]
  rooms.applyFilters({ selectionStatus: next })
}

const triggerLabel = computed(() => {
  const count = rooms.filters.selectionStatus.length
  return count === 0 ? "選考" : `選考(${count})`
})
</script>

<template>
  <div class="filter-bar">
    <div class="filter-bar__item">
      <button
        type="button"
        class="filter-bar__trigger"
        :class="{ 'filter-bar__trigger--active': rooms.filters.selectionStatus.length > 0 }"
        @click="toggleMenu"
      >
        {{ triggerLabel }} ▾
      </button>
      <ul
        v-if="menuOpen"
        class="filter-bar__menu"
      >
        <li
          v-for="status in SELECTION_STATUS_VALUES"
          :key="status"
        >
          <label class="filter-bar__option">
            <input
              type="checkbox"
              :checked="isChecked(status)"
              @change="toggleStatus(status)"
            >
            <span>{{ SELECTION_STATUS_META[status]?.label }}</span>
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  align-items: center;
}

.filter-bar__item {
  position: relative;
}

.filter-bar__trigger {
  padding: 3px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
  font-size: 11px;
}

/* 絞り込みが1つでも掛かっているときはブランド色で示す */
.filter-bar__trigger--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 700;
}

.filter-bar__menu {
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
  padding: 6px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
  list-style: none;
}

.filter-bar__option {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 6px;
  border-radius: var(--radius-sm, 4px);
  font-size: 12px;
  cursor: pointer;
}

.filter-bar__option:hover {
  background-color: color-mix(in srgb, var(--color-primary) 6%, var(--color-canvas));
}
</style>
