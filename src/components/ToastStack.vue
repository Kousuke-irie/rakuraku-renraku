<script setup>
// 通知バナー（uiStore.toasts の描画先・P4-6）
//
// 画面右上に iOS の通知のように重ねる。ここが「気づかせる」唯一の出口で、
// - SLA・会議室などの新着通知（P4-1b：alert:new → ui.receiveAlert）
// - 接続時のまとめ（P4-6：ui.syncAlertSummary）
// - socket の `error` イベント、楽観更新のロールバック
// がすべてここに出る。
//
// ★右上に置く理由：受信箱の左（一覧）・下（入力欄）は操作中の視線が乗る場所で、
//   バナーが被ると邪魔になる。右上は3ペインのどれとも競合しない。
//   以前は右下だったが、AI ランチャー（右下の丸ボタン）との回避に寄りすぎていた。
//
// 表示するだけのコンポーネントで、積む／消すのは uiStore が持つ。
// 遷移だけはここで行う（router はコンポーネントの責務）。
import { onBeforeUnmount, watch } from "vue"
import { useRouter } from "vue-router"
import { useUiStore } from "../stores/ui.js"

// #region constants
/** 自動で閉じるまでの時間。読み切れる程度に長く取る */
const AUTO_DISMISS_MS = 6000
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()
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

// #region browser event handler
/** バナー本体のクリック：該当画面へ飛び、バナーは閉じる */
const onOpen = async (toast) => {
  if (!toast.to) return

  dismiss(toast.id)
  await router.push(toast.to)
}
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
      :class="[
        `toast--${toast.type}`,
        { 'toast--emphasis': toast.emphasis },
      ]"
    >
      <!-- 遷移先があるときだけ押せる。無いバナー（保存しました等）は div で出す -->
      <component
        :is="toast.to ? 'button' : 'div'"
        class="toast__main"
        :class="{ 'toast__main--clickable': toast.to }"
        :type="toast.to ? 'button' : null"
        @click="onOpen(toast)"
      >
        <span
          v-if="toast.title"
          class="toast__head"
        >
          <span class="toast__title">{{ toast.title }}</span>
          <!-- 重要は色だけでなくテキストでも示す（CLAUDE.md §6-13） -->
          <span
            v-if="toast.emphasis"
            class="toast__badge"
          >重要</span>
        </span>
        <span class="toast__message">{{ toast.message }}</span>
      </component>

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
  position: fixed;
  z-index: 100;
  top: var(--space-md);
  right: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  width: 360px;
  max-width: calc(100vw - var(--space-xxl));
}

.toast {
  display: flex;
  gap: var(--space-xs);
  align-items: flex-start;
  padding: var(--space-sm) var(--space-sm) var(--space-sm) var(--space-md);
  border: 1px solid var(--color-hairline);
  border-left-width: 4px;
  border-radius: var(--radius-lg);
  background-color: var(--color-canvas);
  /* 上から降りてくる紙片に見せる。影は既存より一段強く（画面に浮かせる） */
  box-shadow: var(--shadow-2);
  animation: toast-in 180ms ease-out;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 動きを減らす設定を尊重する（アクセシビリティ） */
@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none;
  }
}

.toast--error {
  border-left-color: var(--color-error);
}

.toast--info {
  border-left-color: var(--color-primary);
}

/* 重要（上長エスカレーション）。帯を SLA の赤に振り替えて一段強くする */
.toast--emphasis {
  border-left-color: var(--color-sla-alert);
}

.toast__main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
}

.toast__main--clickable {
  cursor: pointer;
}

.toast__head {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
}

.toast__title {
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.toast__badge {
  flex: none;
  padding: 0 var(--space-xs);
  border-radius: var(--radius-pill);
  background-color: var(--color-sla-alert);
  color: #ffffff;
  font-size: 10px;
  line-height: 1.6;
}

.toast__message {
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
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
