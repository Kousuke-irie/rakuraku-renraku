<script setup>
// GitHub Pets のように画面へ常駐する通知ペット。
// 通知イベントは uiStore が受け取り、ここでは表情・吹き出し・ドラッグ移動を担当する。
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { useUiStore } from "../stores/ui.js"
import defaultImage from "../images/rakusukun/default-cutout.png"
import helloImage from "../images/rakusukun/hello-cutout.png"
import surprisedImage from "../images/rakusukun/surprised-cutout.png"

// #region constants
const EXPRESSION = Object.freeze({
  DEFAULT: "default",
  HELLO: "hello",
  SURPRISED: "surprised",
})
const IMAGE_BY_EXPRESSION = Object.freeze({
  [EXPRESSION.DEFAULT]: defaultImage,
  [EXPRESSION.HELLO]: helloImage,
  [EXPRESSION.SURPRISED]: surprisedImage,
})
const REACTION_MS = 4800
const PET_SIZE = Object.freeze({ width: 132, height: 174, minimized: 52 })
const VIEWPORT_MARGIN = 8
const DRAG_THRESHOLD = 5
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()
let reactionTimer = null
let dragState = null
let suppressNextClick = false
// #endregion

// #region local state
const expression = ref(EXPRESSION.DEFAULT)
const bubbleOpen = ref(false)
const minimized = ref(false)
const greetingOpen = ref(false)
const dragging = ref(false)
const positioned = ref(false)
const position = ref({ x: 0, y: 0 })
// #endregion

// #region computed
const imageUrl = computed(() => IMAGE_BY_EXPRESSION[expression.value])
const notice = computed(() => ui.mascotNotice)
const bubbleTitle = computed(() =>
  greetingOpen.value ? "やっほー！らくす君だよ" : notice.value?.title
)
const bubbleMessage = computed(() =>
  greetingOpen.value ? "通知が届いたら、ここからすぐに知らせるね。" : notice.value?.message
)
const currentSize = computed(() => ({
  width: minimized.value ? PET_SIZE.minimized : PET_SIZE.width,
  height: minimized.value ? PET_SIZE.minimized : PET_SIZE.height,
}))
const petStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  visibility: positioned.value ? "visible" : "hidden",
}))
const bubbleClasses = computed(() => ({
  "pet__bubble--right": position.value.x < 300,
  "pet__bubble--below": position.value.y < 170,
}))
// #endregion

// #region local methods
const clampPosition = ({ x, y }) => ({
  x: Math.min(
    Math.max(VIEWPORT_MARGIN, x),
    Math.max(VIEWPORT_MARGIN, window.innerWidth - currentSize.value.width - VIEWPORT_MARGIN)
  ),
  y: Math.min(
    Math.max(VIEWPORT_MARGIN, y),
    Math.max(VIEWPORT_MARGIN, window.innerHeight - currentSize.value.height - VIEWPORT_MARGIN)
  ),
})

const placePet = () => {
  const initial = ui.petPosition ?? {
    x: window.innerWidth - PET_SIZE.width - 92,
    y: window.innerHeight - PET_SIZE.height - VIEWPORT_MARGIN,
  }
  position.value = clampPosition(initial)
  positioned.value = true
}

const clearReactionTimer = () => {
  if (!reactionTimer) return
  clearTimeout(reactionTimer)
  reactionTimer = null
}

const resetExpressionLater = () => {
  clearReactionTimer()
  reactionTimer = setTimeout(() => {
    expression.value = EXPRESSION.DEFAULT
    reactionTimer = null
  }, REACTION_MS)
}

const reactToNotice = () => {
  minimized.value = false
  position.value = clampPosition(position.value)
  greetingOpen.value = false
  expression.value = EXPRESSION.SURPRISED
  bubbleOpen.value = true
  resetExpressionLater()
}

const greet = () => {
  greetingOpen.value = true
  expression.value = EXPRESSION.HELLO
  bubbleOpen.value = true
  resetExpressionLater()
}

const closeBubble = () => {
  bubbleOpen.value = false
  greetingOpen.value = false
  expression.value = EXPRESSION.DEFAULT
  clearReactionTimer()
}

const minimize = () => {
  closeBubble()
  minimized.value = true
  position.value = clampPosition(position.value)
}

const restore = () => {
  minimized.value = false
  position.value = clampPosition(position.value)
  greet()
}

const consumeDraggedClick = () => {
  if (!suppressNextClick) return false
  suppressNextClick = false
  return true
}

const onCharacterClick = () => {
  if (!consumeDraggedClick()) greet()
}

const onRestoreClick = () => {
  if (!consumeDraggedClick()) restore()
}

const onPointerMove = (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY

  if (!dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
  dragState.moved = true
  dragging.value = true
  position.value = clampPosition({
    x: dragState.originX + dx,
    y: dragState.originY + dy,
  })
}

const finishDrag = (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  if (dragState.moved) {
    ui.setPetPosition(position.value)
    suppressNextClick = true
    setTimeout(() => {
      suppressNextClick = false
    }, 0)
  }
  dragState = null
  dragging.value = false
  window.removeEventListener("pointermove", onPointerMove)
  window.removeEventListener("pointerup", finishDrag)
  window.removeEventListener("pointercancel", finishDrag)
}

const startDrag = (event) => {
  if (event.button !== 0) return
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: position.value.x,
    originY: position.value.y,
    moved: false,
  }
  window.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", finishDrag)
  window.addEventListener("pointercancel", finishDrag)
}

const onResize = () => {
  position.value = clampPosition(position.value)
}

const openNotification = async () => {
  const destination = notice.value?.destination ?? "/notifications"
  closeBubble()
  await router.push(destination)
}
// #endregion

// #region lifecycle
watch(
  () => notice.value?.id,
  (noticeId) => {
    if (noticeId) reactToNotice()
  }
)

onMounted(() => {
  placePet()
  window.addEventListener("resize", onResize)
})

onBeforeUnmount(() => {
  clearReactionTimer()
  window.removeEventListener("resize", onResize)
  window.removeEventListener("pointermove", onPointerMove)
  window.removeEventListener("pointerup", finishDrag)
  window.removeEventListener("pointercancel", finishDrag)
})
// #endregion
</script>

<template>
  <aside
    class="pet"
    :class="{ 'pet--minimized': minimized, 'pet--dragging': dragging }"
    :style="petStyle"
    aria-label="通知ペット らくす君"
  >
    <button
      v-if="minimized"
      type="button"
      class="pet__restore"
      title="らくす君を表示（ドラッグで移動）"
      aria-label="らくす君を表示"
      @pointerdown="startDrag"
      @click="onRestoreClick"
    >
      <img
        :src="defaultImage"
        alt=""
        draggable="false"
      >
      <span
        v-if="ui.alertsUnreadCount > 0"
        class="pet__badge"
        aria-hidden="true"
      >{{ ui.alertsUnreadCount }}</span>
    </button>

    <template v-else>
      <section
        v-if="bubbleOpen && bubbleTitle"
        class="pet__bubble"
        :class="bubbleClasses"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          class="pet__bubble-close"
          aria-label="吹き出しを閉じる"
          @click="closeBubble"
        >
          ×
        </button>
        <strong class="pet__bubble-title">{{ bubbleTitle }}</strong>
        <p class="pet__bubble-message">
          {{ bubbleMessage }}
        </p>
        <button
          v-if="!greetingOpen && notice"
          type="button"
          class="pet__action"
          @click="openNotification"
        >
          通知を確認する
        </button>
      </section>

      <button
        type="button"
        class="pet__character"
        title="クリックで挨拶・ドラッグで移動"
        aria-label="らくす君にあいさつする"
        @pointerdown="startDrag"
        @click="onCharacterClick"
      >
        <img
          :key="expression"
          :src="imageUrl"
          alt=""
          class="pet__image"
          draggable="false"
        >
      </button>

      <button
        type="button"
        class="pet__minimize"
        title="らくす君をしまう"
        aria-label="らくす君をしまう"
        @click="minimize"
      >
        −
      </button>
    </template>
  </aside>
</template>

<style scoped>
.pet {
  position: fixed;
  z-index: 90;
  width: 132px;
  height: 174px;
  pointer-events: none;
  will-change: left, top;
}

.pet--minimized {
  width: 52px;
  height: 52px;
}

.pet__character {
  position: relative;
  display: block;
  width: 132px;
  height: 174px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  transition: transform 160ms ease;
}

.pet:not(.pet--dragging) .pet__character:hover {
  transform: translateY(-4px) rotate(-1deg);
}

.pet--dragging .pet__character,
.pet--dragging .pet__restore {
  cursor: grabbing;
}

.pet__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 6px 8px rgb(0 0 0 / 18%));
  user-select: none;
  animation: pet-arrive 260ms ease-out;
}

.pet__bubble {
  position: absolute;
  right: 16px;
  bottom: 188px;
  width: 248px;
  padding: var(--space-md) var(--space-lg);
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, var(--color-hairline));
  border-radius: var(--radius-xl) var(--radius-xl) var(--radius-xs) var(--radius-xl);
  background: var(--color-canvas);
  box-shadow: var(--shadow-2);
  pointer-events: auto;
}

.pet__bubble--right {
  right: auto;
  left: 16px;
  border-radius: var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs);
}

.pet__bubble--below {
  top: 188px;
  bottom: auto;
}

.pet__bubble::after {
  position: absolute;
  right: 0;
  bottom: -10px;
  width: 18px;
  height: 18px;
  background: var(--color-canvas);
  clip-path: polygon(0 0, 100% 0, 100% 100%);
  content: "";
}

.pet__bubble--right::after {
  right: auto;
  left: 0;
  transform: scaleX(-1);
}

.pet__bubble--below::after {
  top: -10px;
  bottom: auto;
  transform: scaleY(-1);
}

.pet__bubble--right.pet__bubble--below::after {
  transform: scale(-1);
}

.pet__bubble-title {
  display: block;
  padding-right: var(--space-xl);
  color: var(--color-primary);
  font-size: 13px;
}

.pet__bubble-message {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.pet__bubble-close,
.pet__minimize {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-canvas);
  color: var(--color-ink-mute);
  pointer-events: auto;
}

.pet__bubble-close {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  width: 24px;
  height: 24px;
  font-size: 16px;
}

.pet__minimize {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 26px;
  height: 26px;
  border: 1px solid var(--color-hairline);
  box-shadow: var(--shadow-1);
  font-size: 16px;
}

.pet__bubble-close:hover,
.pet__minimize:hover {
  color: var(--color-ink);
}

.pet__action {
  margin-top: var(--space-sm);
  padding: 5px 12px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: 700;
}

.pet__restore {
  position: relative;
  display: block;
  width: 52px;
  height: 52px;
  overflow: visible;
  padding: 3px;
  border: 2px solid var(--color-canvas);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  box-shadow: var(--shadow-2);
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
}

.pet__restore img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

.pet__badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 2px solid var(--color-canvas);
  border-radius: var(--radius-pill);
  background: var(--color-sla-alert);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
}

@keyframes pet-arrive {
  from {
    opacity: 0.75;
    transform: translateY(8px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pet__character,
  .pet__image {
    animation: none;
    transition: none;
  }
}
</style>
