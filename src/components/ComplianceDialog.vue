<script setup>
// 送信前チェックの警告ダイアログ（P4-3）
//
// 就職差別・オワハラの疑いがある本文を送ろうとしたときに出す。
// **送信を物理的に禁止しない。** 「このまま送信」を選べる代わりに、その事実が
// サーバ側で記録される（monitoring.md §4 決定事項4）。業務を止めないことを優先し、
// 無視した記録が残ることを監視の価値とする設計。
//
// ダイアログを閉じても本文は消えない。修正して送り直せる。
//
// ProfileDialog と同じく native <dialog> の showModal() を使う（backdrop・
// フォーカストラップ・top layer が標準で付く）。Esc も同じ理由で自前で拾う。
import { computed, nextTick, ref, watch } from "vue"
import {
  ALERT_SEVERITY,
  ALERT_SEVERITY_META,
  COMPLIANCE_CATEGORY_META,
  COMPLIANCE_DISCLAIMER,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"

const emit = defineEmits(["send"])

// #region global state
const ui = useUiStore()
// #endregion

// #region local variable
/** @type {import('vue').Ref<HTMLDialogElement|null>} */
const dialogEl = ref(null)
/** 既定フォーカス。誤って Enter を押しても送信されないよう「修正する」に当てる */
const fixButtonEl = ref(null)
// #endregion

// #region computed
/** block が1件でもあれば見出しの語調を強める */
const hasBlocking = computed(() =>
  ui.complianceResults.some((result) => result.severity === ALERT_SEVERITY.BLOCK)
)

const title = computed(() =>
  hasBlocking.value ? "送信前の確認（要修正）" : "送信前の確認"
)

const categoryLabel = (category) => COMPLIANCE_CATEGORY_META[category]?.label ?? category
const severityLabel = (severity) => ALERT_SEVERITY_META[severity]?.label ?? severity
// #endregion

// #region lifecycle
watch(
  () => ui.complianceDialogOpen,
  async (open) => {
    const dialog = dialogEl.value
    if (!dialog) return

    if (open) {
      dialog.showModal()
      // v-for のボタンが描画されてから当てる（既定フォーカスは「修正する」）
      await nextTick()
      fixButtonEl.value?.focus()
      return
    }
    dialog.close()
  }
)
// #endregion

// #region browser event handler
/** 「修正する」。本文はそのまま入力欄に残す */
const onFix = () => ui.closeComplianceDialog()

/**
 * 「このまま送信」。承知したルールコードを添えて親（ChatPanel）に送信を任せる。
 * 閉じる前にコードを控えておくこと（close で complianceResults が空になるため）。
 */
const onSendAnyway = () => {
  const acknowledgedCodes = [...ui.complianceCodes]
  ui.closeComplianceDialog()
  emit("send", acknowledgedCodes)
}

/** backdrop のクリックは dialog 自身が target になる（中身のクリックでは閉じない） */
const onBackdropClick = (event) => {
  if (event.target === dialogEl.value) onFix()
}
// #endregion
</script>

<template>
  <dialog
    ref="dialogEl"
    class="dialog"
    aria-labelledby="compliance-dialog-title"
    @click="onBackdropClick"
    @close="onFix"
    @keydown.escape.prevent="onFix"
  >
    <div class="dialog__body">
      <h2
        id="compliance-dialog-title"
        class="dialog__title"
      >
        <!-- 記号だけに意味を持たせない。テキストで種別が分かるようにする（CLAUDE.md §6-13） -->
        <span aria-hidden="true">⚠</span>
        {{ title }}
      </h2>

      <ul class="dialog__list">
        <li
          v-for="result in ui.complianceResults"
          :key="result.code"
          class="finding"
        >
          <p class="finding__head">
            <span class="finding__category">{{ categoryLabel(result.category) }}</span>
            <span
              class="finding__severity"
              :class="`finding__severity--${result.severity}`"
            >{{ severityLabel(result.severity) }}</span>
          </p>
          <!-- 該当箇所。v-html は使わずテキスト補間で出す（CLAUDE.md §6-10） -->
          <p class="finding__matched">
            「{{ result.matched }}」
          </p>
          <p class="finding__message">
            {{ result.message }}
          </p>
        </li>
      </ul>

      <!-- 断定を避ける。法的判断の代行に見せないための免責（monitoring.md §4） -->
      <p class="dialog__disclaimer">
        {{ COMPLIANCE_DISCLAIMER }}
      </p>

      <div class="dialog__actions">
        <button
          type="button"
          class="button-ghost"
          @click="onSendAnyway"
        >
          このまま送信
        </button>
        <button
          ref="fixButtonEl"
          type="button"
          class="button-primary"
          @click="onFix"
        >
          修正する
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* ProfileDialog と同じ作り。margin: auto が無いと showModal でも中央に来ない */
.dialog {
  width: min(480px, calc(100vw - var(--space-huge) * 2));
  max-height: calc(100vh - var(--space-huge) * 2);
  margin: auto;
  padding: 0;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  box-shadow: var(--shadow-2);
}

.dialog::backdrop {
  background-color: rgb(29 29 29 / 32%);
}

.dialog__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-xxl);
}

.dialog__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

/* 検知が多いときはここだけスクロールさせ、ボタンは常に見えるようにする */
.dialog__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.finding {
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-lg);
  background-color: var(--color-orange-soft);
}

.finding__head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0 0 var(--space-xs);
}

.finding__category {
  font-size: 13px;
  font-weight: 600;
}

/* 重大度は色だけでなくテキストでも示す（CLAUDE.md §6-13） */
.finding__severity {
  padding: 1px var(--space-sm);
  border-radius: var(--radius-pill);
  font-size: 11px;
  line-height: 1.6;
}

.finding__severity--block {
  background-color: var(--color-sla-alert);
  color: #ffffff;
}

.finding__severity--warn {
  background-color: var(--color-canvas-cream);
  color: var(--color-ink);
}

.finding__matched {
  margin: 0 0 var(--space-xs);
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.finding__message {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.7;
}

.dialog__disclaimer {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}
</style>
