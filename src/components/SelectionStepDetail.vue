<script setup>
// 選考ステップの詳細（S-09 / P2-11）
//
// フロー図で選んだ1ステップの「内容」「ポイント」、完了済みなら「企業からのFB」を出す。
//
// ★FB は完了済みのぶんしかサーバが返さない（server/services/selectionFlow.js）。
//   ここで state を見て隠す作りにはしない。クライアントの分岐は表示の都合であって、
//   見せてよいかの判断はサーバが持つ。
import { computed } from "vue"
import { FLOW_STEP_STATE, FLOW_STEP_STATE_META } from "../constants/index.js"

const props = defineProps({
  /** @type {{statusKey: string, label: string, description: string|null,
   *           points: string|null, state: string, feedback: object|null}|null} */
  step: { type: Object, default: null },
})

// #region computed
const stateLabel = computed(() => FLOW_STEP_STATE_META[props.step?.state]?.label ?? "")

const isCurrent = computed(() => props.step?.state === FLOW_STEP_STATE.CURRENT)
const isDone = computed(() => props.step?.state === FLOW_STEP_STATE.DONE)

/** 改行を段落に割る。v-html は使わない（frontend.md §10-1） */
const toParagraphs = (text) =>
  (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

const descriptionParagraphs = computed(() => toParagraphs(props.step?.description))
const pointsParagraphs = computed(() => toParagraphs(props.step?.points))
const feedbackParagraphs = computed(() => toParagraphs(props.step?.feedback?.body))

const hasAnyContent = computed(
  () => descriptionParagraphs.value.length > 0 || pointsParagraphs.value.length > 0
)
// #endregion
</script>

<template>
  <section
    v-if="step"
    :key="step.statusKey"
    class="detail"
    aria-live="polite"
  >
    <header class="detail__head">
      <h3 class="detail__title">
        {{ step.label }}
      </h3>
      <span
        class="detail__state"
        :class="{
          'detail__state--current': isCurrent,
          'detail__state--done': isDone,
        }"
      >{{ stateLabel }}</span>
    </header>

    <div class="detail__body">
      <p
        v-if="!hasAnyContent"
        class="detail__empty"
      >
        この選考の詳細はまだ公開されていません。
      </p>

      <div
        v-if="descriptionParagraphs.length > 0"
        class="detail__block"
      >
        <h4 class="detail__label">
          この選考について
        </h4>
        <p
          v-for="(paragraph, index) in descriptionParagraphs"
          :key="index"
          class="detail__text"
        >
          {{ paragraph }}
        </p>
      </div>

      <div
        v-if="pointsParagraphs.length > 0"
        class="detail__block detail__block--points"
      >
        <h4 class="detail__label">
          ポイント
        </h4>
        <p
          v-for="(paragraph, index) in pointsParagraphs"
          :key="index"
          class="detail__text"
        >
          {{ paragraph }}
        </p>
      </div>

      <!-- 企業からのフィードバック。完了済みのステップにだけ届く -->
      <div
        v-if="feedbackParagraphs.length > 0"
        class="detail__block detail__block--feedback"
      >
        <h4 class="detail__label detail__label--feedback">
          企業からのフィードバック
        </h4>
        <p
          v-for="(paragraph, index) in feedbackParagraphs"
          :key="index"
          class="detail__text"
        >
          {{ paragraph }}
        </p>
      </div>

      <p
        v-else-if="isDone"
        class="detail__pending"
      >
        フィードバックが届くとここに表示されます。
      </p>
    </div>
  </section>
</template>

<style scoped>
.detail {
  border-top: 1px solid var(--color-hairline);
  /* 切り替えたことが分かる程度の短い立ち上がり。待たせない */
  animation: detail-in 160ms ease;
}

@keyframes detail-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.detail__head {
  display: flex;
  gap: var(--space-md);
  align-items: baseline;
  padding: var(--space-lg) var(--space-xxl) 0;
}

.detail__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.detail__state {
  flex: none;
  padding: 2px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
}

.detail__state--current {
  border-color: var(--color-primary);
  background-color: var(--color-orange-soft);
  color: var(--color-primary);
}

.detail__state--done {
  border-color: var(--color-ink);
  background-color: var(--color-ink);
  color: var(--color-canvas);
}

.detail__body {
  padding: var(--space-md) var(--space-xxl) var(--space-xxl);
}

.detail__block + .detail__block {
  margin-top: var(--space-lg);
}

/* ポイントとFBは「読ませたい塊」なので面を敷いて本文から立ち上げる */
.detail__block--points,
.detail__block--feedback {
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas-cream);
}

.detail__block--feedback {
  border-left: 3px solid var(--color-primary);
  background-color: var(--color-orange-soft);
}

.detail__label {
  margin: 0 0 var(--space-xs);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.detail__label--feedback {
  color: var(--color-primary);
}

.detail__text {
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  line-height: 1.85;
}

.detail__text:last-child {
  margin-bottom: 0;
}

.detail__empty,
.detail__pending {
  margin: var(--space-lg) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.detail__empty {
  margin-top: 0;
}

@media (prefers-reduced-motion: reduce) {
  .detail {
    animation: none;
  }
}
</style>
