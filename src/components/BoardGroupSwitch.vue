<script setup>
// ホームのボードを縦割りにする軸の切替（S-07・frontend.md §5-2）
//
// 対応／選考／緊急度 の3択。既定は対応。状態は uiStore.boardGroupBy が持つ。
// ラジオボタン相当なので、role="radiogroup" にして矢印キーでなく Tab + Enter で選べる
// 素朴なボタン群にしてある（選択肢が3つしかないため）。
import { computed } from "vue"
import { BOARD_GROUP_BY_META, BOARD_GROUP_BY_VALUES } from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"

// #region global state
const ui = useUiStore()
// #endregion

// #region computed
const options = computed(() =>
  BOARD_GROUP_BY_VALUES.map((value) => ({
    value,
    label: BOARD_GROUP_BY_META[value].label,
  }))
)
// #endregion
</script>

<template>
  <div class="switch">
    <span
      id="board-group-switch-label"
      class="switch__caption"
    >縦割り</span>

    <div
      class="switch__group"
      role="radiogroup"
      aria-labelledby="board-group-switch-label"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="switch__button"
        :class="{ 'switch__button--active': ui.boardGroupBy === option.value }"
        role="radio"
        :aria-checked="ui.boardGroupBy === option.value"
        @click="ui.setBoardGroupBy(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.switch {
  display: inline-flex;
  gap: var(--space-sm);
  align-items: center;
}

.switch__caption {
  color: var(--color-ink-mute);
  font-size: 12px;
  font-weight: 700;
}

/* 3つで1つのコントロールに見えるよう、外枠のピルの中にボタンを並べる */
.switch__group {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--color-ink) 4%, var(--color-canvas));
}

.switch__button {
  padding: 4px 14px;
  border: 0;
  border-radius: var(--radius-pill);
  background-color: transparent;
  color: var(--color-ink-mute);
  font-size: 12px;
  font-weight: 700;
}

.switch__button:hover:not(.switch__button--active) {
  color: var(--color-ink);
}

/* 選択中はブランド色（DESIGN.md：オレンジは CTA とアクティブ状態のみ） */
.switch__button--active {
  background-color: var(--color-canvas);
  color: var(--color-primary);
  box-shadow: var(--shadow-3);
}
</style>
