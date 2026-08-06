<script setup>
// AI 起動ボタン（S-07 / P3-1a・frontend.md §5-2）
//
// 画面右下に固定した円形ボタン。チャットボットの起動ボタンと同じ体裁で、
// 押すと右カラムの AI 現況サマリーを開き、未生成なら生成を要求する。
//
// ★AppShell の外（HomeView 直下）ではなく position: fixed で画面に固定する。
//   AppShell は overflow: hidden なので、通常フローに置くとペイン内に閉じ込められてしまう。
import { computed } from "vue"
import { AI_SUMMARY_STATUS } from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region computed
const isLoading = computed(() => rooms.aiSummary.status === AI_SUMMARY_STATUS.LOADING)

/** アイコンだけのボタンなので、ラベルは title と aria-label で必ず補う */
const label = computed(() => {
  if (isLoading.value) return "AI が要約を生成しています"
  return ui.aiPanelOpen ? "AI 現況サマリーを閉じる" : "AI 現況サマリーを開く"
})
// #endregion

// #region browser event handler
const onClick = () => {
  const willOpen = !ui.aiPanelOpen
  ui.toggleAiPanel()

  // 開くタイミングで未生成なら生成を促す。生成済み・生成中は触らない
  if (willOpen && rooms.aiSummary.status === AI_SUMMARY_STATUS.IDLE) {
    rooms.regenerateAiSummary()
  }
}
// #endregion
</script>

<template>
  <button
    type="button"
    class="ai-fab"
    :class="{ 'ai-fab--loading': isLoading, 'ai-fab--active': ui.aiPanelOpen }"
    :title="label"
    :aria-label="label"
    :aria-expanded="ui.aiPanelOpen"
    @click="onClick"
  >
    <svg
      class="ai-fab__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3.5 l1.9 4.6 l4.6 1.9 l-4.6 1.9 l-1.9 4.6 l-1.9-4.6 l-4.6-1.9 l4.6-1.9 z" />
      <path d="M18 15.5 l.8 2 l2 .8 l-2 .8 l-.8 2 l-.8-2 l-2-.8 l2-.8 z" />
    </svg>
  </button>
</template>

<style scoped>
.ai-fab {
  position: fixed;
  z-index: 30;
  right: var(--space-xxl);
  bottom: var(--space-xxl);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background-image: linear-gradient(135deg, var(--color-primary) 0%, #b64bff 100%);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-1);
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;
}

.ai-fab:hover {
  box-shadow: var(--shadow-2);
  transform: translateY(-2px);
}

.ai-fab:active {
  transform: translateY(0);
}

/* 開いている間はへこませて、押しっぱなしの状態が分かるようにする */
.ai-fab--active {
  box-shadow: var(--shadow-3);
}

.ai-fab__icon {
  width: 24px;
  height: 24px;
}

/* 生成中はアイコンをゆっくり回す。ボタン自体は押せる状態のまま残す */
.ai-fab--loading .ai-fab__icon {
  animation: spin 1.6s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-fab,
  .ai-fab__icon {
    animation: none;
    transition: none;
  }
}
</style>
