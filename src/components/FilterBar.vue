<script setup>
// フィルタ・ソート UI（P1-7・frontend.md §5/§9）
//
// 対応ステータス／選考ステータス／用件タグ／緊急度を**複数選択**で絞り込む。
// ソート切替と「条件をクリア」を併せ持つ。
//
// 担当者による絞り込みは提供しない。受信箱は担当制で、そもそも自分の担当ルームしか
// 出ないため（#28・roomsStore.myRooms）。
//
// 絞り込みの判定そのものは roomsStore の filteredRooms / sortedRooms が持ち、
// このコンポーネントは条件を組み立てて applyFilters に渡すだけにする（frontend.md §3）。
//
// 列挙値と日本語ラベルは必ず shared/constants.js の *_META から引く（CLAUDE.md §6-1）。
import { computed, ref } from "vue"
import {
  HANDLING_STATUS_META,
  HANDLING_STATUS_VALUES,
  SELECTION_STATUS_META,
  SELECTION_STATUS_VALUES,
  SORT_KEY_META,
  SORT_KEY_VALUES,
  TOPIC_TAG_META,
  TOPIC_TAG_VALUES,
  URGENCY_META,
  URGENCY_VALUES,
} from "../constants/index.js"
import { useDismissOnOutside } from "../composables/useDismissOnOutside.js"
import { useRoomsStore } from "../stores/rooms.js"

// #region constants
/**
 * 複数選択フィルタの定義。ここに1行足せば絞り込みが1種類増える。
 * key は roomsStore.filters のキーと一致させること。
 */
const MULTI_FILTERS = Object.freeze([
  { key: "handlingStatus", label: "対応", values: HANDLING_STATUS_VALUES, meta: HANDLING_STATUS_META },
  { key: "selectionStatus", label: "選考", values: SELECTION_STATUS_VALUES, meta: SELECTION_STATUS_META },
  { key: "topicTag", label: "タグ", values: TOPIC_TAG_VALUES, meta: TOPIC_TAG_META },
  { key: "urgency", label: "緊急度", values: URGENCY_VALUES, meta: URGENCY_META },
])
// #endregion

// #region global state
const rooms = useRoomsStore()
// #endregion

// #region local state
/** @type {import('vue').Ref<string|null>} 開いているメニューの key。同時に1つだけ開く */
const openMenuKey = ref(null)
// #endregion

// #region computed
const isMenuOpen = computed(() => openMenuKey.value !== null)

// #endregion

// #region local methods
const closeMenu = () => {
  openMenuKey.value = null
}

const toggleMenu = (key) => {
  openMenuKey.value = openMenuKey.value === key ? null : key
}

const isChecked = (key, value) => rooms.filters[key].includes(value)

/** チェックのたびに即座に絞り込みへ反映する（requirements.md P1-7） */
const toggleValue = (key, value) => rooms.toggleFilterValue(key, value)

/** 選択済みの件数を出して、閉じていても何で絞っているか分かるようにする */
const triggerLabelOf = (filter) => {
  const count = rooms.filters[filter.key].length
  return count === 0 ? filter.label : `${filter.label}(${count})`
}

// #endregion

// #region lifecycle
useDismissOnOutside(isMenuOpen, closeMenu)
// #endregion
</script>

<template>
  <!-- メニュー内のクリックで閉じないよう、バー全体で伝播を止める -->
  <div
    class="filter-bar"
    @click.stop
  >
    <!-- 複数選択のフィルタ -->
    <div
      v-for="filter in MULTI_FILTERS"
      :key="filter.key"
      class="filter-bar__item"
    >
      <button
        type="button"
        class="filter-bar__trigger"
        :class="{ 'filter-bar__trigger--active': rooms.filters[filter.key].length > 0 }"
        aria-haspopup="true"
        :aria-expanded="openMenuKey === filter.key"
        @click="toggleMenu(filter.key)"
      >
        {{ triggerLabelOf(filter) }} ▾
      </button>
      <ul
        v-if="openMenuKey === filter.key"
        class="filter-bar__menu"
      >
        <li
          v-for="value in filter.values"
          :key="value"
        >
          <label class="filter-bar__option">
            <input
              type="checkbox"
              :checked="isChecked(filter.key, value)"
              @change="toggleValue(filter.key, value)"
            >
            <span>{{ filter.meta[value]?.label }}</span>
          </label>
        </li>
      </ul>
    </div>

    <button
      v-if="rooms.hasActiveFilters"
      type="button"
      class="filter-bar__clear"
      @click="rooms.clearFilters()"
    >
      条件をクリア
    </button>

    <label class="filter-bar__sort">
      <span class="sr-only">並び順</span>
      <select
        class="filter-bar__select"
        aria-label="並び順"
        :value="rooms.sortKey"
        @change="rooms.setSortKey($event.target.value)"
      >
        <option
          v-for="key in SORT_KEY_VALUES"
          :key="key"
          :value="key"
        >
          {{ SORT_KEY_META[key]?.label }}
        </option>
      </select>
    </label>
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
  cursor: pointer;
}

.filter-bar__trigger:hover {
  border-color: var(--color-ink-mute);
}

/* 絞り込みが掛かっているものはブランド色で示す（件数表示と二重表現） */
.filter-bar__trigger--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 700;
}

.filter-bar__menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  min-width: 140px;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
  list-style: none;
}

.filter-bar__option {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
  width: 100%;
  padding: 4px 6px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  background: none;
  color: var(--color-ink);
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.filter-bar__option:hover {
  background-color: color-mix(in srgb, var(--color-primary) 6%, var(--color-canvas));
}

.filter-bar__clear {
  padding: 3px 8px;
  border: none;
  background: none;
  color: var(--color-primary);
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
}

.filter-bar__sort {
  margin-left: auto;
}

/* 他のフィルタチップと同じピル型に揃える */
.filter-bar__select {
  max-width: 116px;
  padding: 3px 18px 3px 8px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
</style>
