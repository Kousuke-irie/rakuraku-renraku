<script setup>
// ペインの境目に置く幅変更のつまみ（受信箱の3ペイン・frontend.md §5）
//
// ペイン間の隙間そのものをつまみにしているので、見た目を変えずに掴める。
// Pointer Events + setPointerCapture を使い、ポインタがペインの上へ外れても
// ドラッグが途切れないようにする。幅の保持は uiStore の責務。
//
// role="separator" + tabindex でキーボード（←→）でも動かせる。
// マウスを持たない人でも幅を変えられるようにするため。
import { ref } from "vue"

// #region constants
/** ←→ 1回あたりの移動量（px） */
const KEYBOARD_STEP = 16
// #endregion

const props = defineProps({
  /** 現在の幅（px） */
  modelValue: { type: Number, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  /** ダブルクリックで戻す既定の幅（px） */
  defaultValue: { type: Number, required: true },
  /** 右へドラッグすると幅が増える側は 1、減る側（右ペイン）は -1 */
  direction: { type: Number, default: 1 },
  /** スクリーンリーダー・ツールチップ用の名前（例：「一覧の幅」） */
  label: { type: String, required: true },
})

const emit = defineEmits(["update:modelValue"])

// #region local state
const dragging = ref(false)
/** ドラッグ開始時のポインタ位置と幅。移動量から新しい幅を出す */
let startX = 0
let startWidth = 0
// #endregion

// #region local methods
const clamp = (width) => Math.min(props.max, Math.max(props.min, Math.round(width)))

const apply = (width) => {
  const next = clamp(width)
  if (next !== props.modelValue) emit("update:modelValue", next)
}

const onPointerDown = (event) => {
  if (event.button !== 0) return

  // ドラッグ中に周囲のテキストが選択されるのを防ぐ
  event.preventDefault()
  dragging.value = true
  startX = event.clientX
  startWidth = props.modelValue
  event.currentTarget.setPointerCapture(event.pointerId)
}

const onPointerMove = (event) => {
  if (!dragging.value) return
  apply(startWidth + (event.clientX - startX) * props.direction)
}

const onPointerUp = (event) => {
  if (!dragging.value) return

  dragging.value = false
  event.currentTarget.releasePointerCapture(event.pointerId)
}

/** キー操作。見た目の移動方向と一致させるため direction を掛ける */
const nudge = (delta) => apply(props.modelValue + delta * props.direction)

const reset = () => apply(props.defaultValue)
// #endregion
</script>

<template>
  <div
    class="resizer"
    :class="{ 'resizer--active': dragging }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    :aria-valuenow="modelValue"
    :aria-valuemin="min"
    :aria-valuemax="max"
    tabindex="0"
    :title="`${label}を変える（ダブルクリックで既定に戻す）`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="reset"
    @keydown.left.prevent="nudge(-KEYBOARD_STEP)"
    @keydown.right.prevent="nudge(KEYBOARD_STEP)"
  />
</template>

<style scoped>
.resizer {
  /* 幅はグリッドの列（＝従来のペイン間の隙間）が決める */
  position: relative;
  align-self: stretch;
  cursor: col-resize;
  /* ドラッグがスクロール操作に取られないようにする */
  touch-action: none;
}

/* 掴めることは掴んだとき・触れたときだけ示す。既定では隙間のまま見せる */
.resizer::after {
  content: "";
  position: absolute;
  inset-block: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  border-radius: var(--radius-pill);
  background-color: transparent;
}

.resizer:hover::after,
.resizer:focus-visible::after,
.resizer--active::after {
  background-color: var(--color-primary);
}

/* 既定のフォーカスリングは隙間には太すぎるので、上の線で位置を示す */
.resizer:focus-visible {
  outline: none;
}
</style>
