<script setup>
// 通知トースト（uiStore.toasts の描画先）
//
// 失敗を黙って握りつぶさないための共通の出口。
// - socket の `error` イベント（useSocket.js）
// - 楽観更新のロールバック（P1-2 対応ステータス変更）
//
// 表示するだけのコンポーネントで、積む／消すのは uiStore が持つ。
// 自動で消える必要があるものだけタイマーで dismiss する。
import { onBeforeUnmount, watch } from "vue"
import { useUiStore } from "../stores/ui.js"

// #region constants
/** 自動で閉じるまでの時間。読み切れる程度に長く取る */
const AUTO_DISMISS_MS = 6000
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
/** @type {Map<number, ReturnType<typeof setTimeout>>} トーストID → 自動クローズのタイマー */
const timers = new Map()
// #endregion

// #region local methods
const scheduleDismiss = (toast) => {
  if (timers.has(toast.id)) return

  timers.set(
    toast.id,
    setTimeout(() => {
      timers.delete(toast.id)
      ui.dismissToast(toast.id)
    }, AUTO_DISMISS_MS)
  )
}

const dismiss = (id) => {
  clearTimeout(timers.get(id))
  timers.delete(id)
  ui.dismissToast(id)
}
// #endregion

// #region lifecycle
watch(
  () => ui.toasts,
  (toasts) => toasts.forEach(scheduleDismiss),
  { deep: true, immediate: true }
)

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  timers.clear()
})
// #endregion
</script>

<template>
  <!-- role="status" で読み上げにも流す（色だけで伝えない・CLAUDE.md §6-13） -->
  <div
    v-if="ui.toasts.length > 0"
    class="toasts"
    role="status"
    aria-live="polite"
  >
    <div
      v-for="toast in ui.toasts"
      :key="toast.id"
      class="toast"
      :class="`toast--${toast.type}`"
    >
      <p class="toast__message">
        {{ toast.message }}
      </p>
      <button
        type="button"
        class="toast__close"
        aria-label="通知を閉じる"
        @click="dismiss(toast.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  /* AI ランチャー（AiLauncherButton の .ai-fab：右下 24px・56px 角）と重ならないよう、
     同じ右端に揃えたうえで FAB の上に積む */
  --ai-fab-clearance: calc(var(--space-xxl) + 56px + var(--space-md));

  position: fixed;
  z-index: 100;
  right: var(--space-xxl);
  bottom: var(--ai-fab-clearance);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-width: 360px;
}

.toast {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-hairline);
  border-left-width: 4px;
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.toast--error {
  border-left-color: var(--color-error);
}

.toast--info {
  border-left-color: var(--color-primary);
}

.toast__message {
  flex: 1 1 auto;
  font-size: 13px;
  line-height: 1.5;
}

.toast__close {
  flex: none;
  border: none;
  background: none;
  color: var(--color-ink-mute);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.toast__close:hover {
  color: var(--color-ink);
}
</style>
