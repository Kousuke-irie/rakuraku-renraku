<script setup>
// 入力欄の上辺に置く高さ変更のつまみ（useComposerHeight とセットで使う）
//
// ペイン幅の PaneResizer と作りを揃えている：Pointer Events + setPointerCapture で
// ポインタが枠の外へ出てもドラッグが途切れないようにし、
// role="separator" + tabindex でキーボード（↑↓）でも動かせるようにする。
//
// modelValue は「手動指定された高さ」で、null は自動追従（本文の行数に合わせる）を意味する。
// ダブルクリックで null に戻す。
import { ref } from 'vue'
import { COMPOSER_HEIGHT } from '../composables/useComposerHeight.js'

const props = defineProps({
  /** @type {number|null} 手動指定された高さ（px）。null なら自動追従 */
  modelValue: { type: Number, default: null },
  /** いま実際に適用されている高さ（px）。ドラッグ・キー操作の起点にする */
  currentHeight: { type: Number, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
})

const emit = defineEmits(['update:modelValue'])

// #region local state
const dragging = ref(false)
/** ドラッグ開始時のポインタ位置と高さ。移動量から新しい高さを出す */
let startY = 0
let startHeight = 0
// #endregion

// #region local methods
const clamp = (height) => Math.min(props.max, Math.max(props.min, Math.round(height)))

const apply = (height) => {
  const next = clamp(height)
  if (next !== props.modelValue) emit('update:modelValue', next)
}
// #endregion

// #region browser event handler
const onPointerDown = (event) => {
  if (event.button !== 0) return

  // ドラッグ中に周囲のテキストが選択されるのを防ぐ
  event.preventDefault()
  dragging.value = true
  startY = event.clientY
  startHeight = props.currentHeight
  event.currentTarget.setPointerCapture(event.pointerId)
}

const onPointerMove = (event) => {
  if (!dragging.value) return
  // 上へドラッグすると高くなる（入力欄が上に伸びる）
  apply(startHeight + (startY - event.clientY))
}

const onPointerUp = (event) => {
  if (!dragging.value) return

  dragging.value = false
  event.currentTarget.releasePointerCapture(event.pointerId)
}

const nudge = (delta) => apply(props.currentHeight + delta)

/** 自動追従（本文の行数に合わせる）に戻す */
const reset = () => emit('update:modelValue', null)
// #endregion
</script>

<template>
  <div
    class="handle"
    :class="{ 'handle--active': dragging }"
    role="separator"
    aria-orientation="horizontal"
    aria-label="入力欄の高さ"
    :aria-valuenow="currentHeight"
    :aria-valuemin="min"
    :aria-valuemax="max"
    tabindex="0"
    title="入力欄の高さを変える（ダブルクリックで本文に合わせる）"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="reset"
    @keydown.up.prevent="nudge(COMPOSER_HEIGHT.STEP)"
    @keydown.down.prevent="nudge(-COMPOSER_HEIGHT.STEP)"
  >
    <span
      class="handle__grip"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.handle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 10px;
  cursor: row-resize;
  /* ドラッグがスクロール操作に取られないようにする */
  touch-action: none;
}

/* 掴めることは触れたとき・掴んだときだけ示す（既定は入力欄の余白に見せる） */
.handle__grip {
  width: 32px;
  height: 3px;
  border-radius: var(--radius-pill);
  background-color: transparent;
  transition: background-color 120ms ease;
}

.handle:hover .handle__grip,
.handle:focus-visible .handle__grip,
.handle--active .handle__grip {
  background-color: var(--color-hairline);
}

.handle:focus-visible .handle__grip,
.handle--active .handle__grip {
  background-color: var(--color-primary);
}

.handle:focus-visible {
  outline: none;
}
</style>
