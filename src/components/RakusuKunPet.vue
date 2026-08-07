<script setup>
// GitHub Pets のように画面へ常駐する通知ペット。
// 通知イベントは uiStore が受け取り、ここでは表情・吹き出し・ドラッグ移動を担当する。
//
// ★ホーム右下にあった AI 起動ボタンはここへ統合した。
//   らくす君をクリックすると出るのは**吹き出しまで**で、そこから
//   「通知を確認する」「今日の ToDo を聞く」の2つへ分岐する。
//   クリックだけで AI パネルが開くと、通知を見たいだけのときに邪魔になる。
//   らくす君はどの画面にも常駐しているので、**どの画面からでも ToDo を聞ける**。
//   学生にはサーバ側に ToDo が無いので（人事のみ）、通知への導線だけを出す。
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { useAiTodo } from "../composables/useAiTodo.js"
import { useUiStore } from "../stores/ui.js"
import { clampToViewport, defaultPetPosition, petBoxSize } from "../utils/petLayout.js"
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
const DRAG_THRESHOLD = 5
/** 画面の寸法が取れるまで待つ上限（フレーム数）。約1秒 */
const PLACE_RETRY_LIMIT = 60

/** 通知が無いときに出す挨拶。ここが2つの導線の入口になる */
const GREETING = Object.freeze({
  TITLE: "やっほー！らくす君だよ",
  WITH_TODO: "未読の通知と、今日の ToDo。どっちも下のボタンから見られるよ。",
  NOTICE_ONLY: "通知が届いたら、ここからすぐに知らせるね。",
})
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()
const aiTodo = useAiTodo()
let reactionTimer = null
let dragState = null
let suppressNextClick = false
let placeRetryHandle = null
let placeRetries = 0
// #endregion

// #region local state
const expression = ref(EXPRESSION.DEFAULT)
const bubbleOpen = ref(false)
const greetingOpen = ref(false)
const dragging = ref(false)
const positioned = ref(false)
const position = ref({ x: 0, y: 0 })
// #endregion

// #region computed
const imageUrl = computed(() => IMAGE_BY_EXPRESSION[expression.value])
const notice = computed(() => ui.mascotNotice)
const minimized = computed(() => ui.petMinimized)
const bubbleTitle = computed(() => (greetingOpen.value ? GREETING.TITLE : notice.value?.title))
const bubbleMessage = computed(() => {
  if (!greetingOpen.value) return notice.value?.message
  return aiTodo.available.value ? GREETING.WITH_TODO : GREETING.NOTICE_ONLY
})
const currentSize = computed(() => petBoxSize(minimized.value))
const petStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  visibility: positioned.value ? "visible" : "hidden",
}))
const bubbleClasses = computed(() => ({
  "pet__bubble--right": position.value.x < 300,
  "pet__bubble--below": position.value.y < 170,
}))

/** アイコンだけの当たり判定なので、何が起きるかは title と aria-label で必ず補う */
const characterLabel = computed(() =>
  aiTodo.available.value ? "らくす君に話しかける（通知・今日の ToDo）" : "らくす君にあいさつする"
)

const characterTitle = computed(() => `${characterLabel.value}（ドラッグで移動）`)

/** 未読があるうちは件数まで見せる。開くかどうかの判断がここで済む */
const noticeActionLabel = computed(() =>
  ui.alertsUnreadCount > 0 ? `通知を確認する（${ui.alertsUnreadCount}件）` : "通知を確認する"
)

const todoActionLabel = computed(() => {
  if (aiTodo.isLoading.value) return "ToDo をまとめています…"
  return aiTodo.isOpen.value ? "今日の ToDo を閉じる" : "今日の ToDo を聞く"
})

/** ToDo の件数。開かなくても「何件あるか」だけは分かるようにする */
const todoCount = computed(() => (aiTodo.isOpen.value ? 0 : aiTodo.todoCount.value))
// #endregion

// #region local methods
const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight })

const clampPosition = (target) => clampToViewport(target, currentSize.value, viewportSize())

/**
 * 今いるべき位置。ドラッグで動かしていなければ**常に右下端へ**戻す。
 * 保存位置をそのまま clamp するだけだと、ウィンドウを縮めてから広げたときに
 * 縮んだときの座標へ取り残されて、右下から浮いた中途半端な位置に見える。
 */
const anchoredPosition = () => {
  const view = viewportSize()
  return clampToViewport(
    ui.petPosition ?? defaultPetPosition(view, currentSize.value),
    currentSize.value,
    view
  )
}

/**
 * 立ち位置を決める。画面の寸法が取れるまでは置かない（positioned のまま隠しておく）。
 * レイアウト前は innerWidth/innerHeight が 0 になることがあり、そのまま既定位置を
 * 計算すると画面の外へ出てしまう。
 */
const placePet = () => {
  const view = viewportSize()
  if (!(view.width > 0) || !(view.height > 0)) {
    // 取れないまま回し続けない。諦めたあとは resize が拾う
    if (placeRetries < PLACE_RETRY_LIMIT) {
      placeRetries += 1
      placeRetryHandle = window.requestAnimationFrame(placePet)
    }
    return
  }
  placeRetryHandle = null
  position.value = anchoredPosition()
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
  ui.setPetMinimized(false)
  position.value = anchoredPosition()
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
  ui.setPetMinimized(true)
  position.value = anchoredPosition()
}

const restore = () => {
  ui.setPetMinimized(false)
  position.value = anchoredPosition()
}

const consumeDraggedClick = () => {
  if (!suppressNextClick) return false
  suppressNextClick = false
  return true
}

/**
 * 吹き出しの「今日の ToDo」から呼ぶ。サマリーが開くのは**ここを押したときだけ**。
 * パネルと吹き出しが重なるので、開く前に吹き出しは畳む。
 */
const toggleTodo = () => {
  closeBubble()
  aiTodo.toggle()
}

/** クリックでは吹き出しを出すところまで。その先はユーザーに選ばせる */
const onCharacterClick = () => {
  if (consumeDraggedClick()) return
  greet()
}

const onRestoreClick = () => {
  if (consumeDraggedClick()) return
  restore()
  greet()
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
  if (!positioned.value) placePet()
  else position.value = anchoredPosition()
}

const openNotification = async () => {
  // 届いた通知を見せている間だけその行き先へ飛ぶ。
  // 挨拶から押したときは、直前の通知ではなく一覧を開く
  const destination = greetingOpen.value ? "/notifications" : notice.value?.destination
  closeBubble()
  await router.push(destination ?? "/notifications")
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
  if (placeRetryHandle) window.cancelAnimationFrame(placeRetryHandle)
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
        <!-- 通知と ToDo の2本立て。どちらへ行くかはここで選ばせる -->
        <div class="pet__actions">
          <button
            type="button"
            class="pet__action"
            @click="openNotification"
          >
            {{ noticeActionLabel }}
          </button>
          <button
            v-if="aiTodo.available.value"
            type="button"
            class="pet__action pet__action--ghost"
            :aria-expanded="aiTodo.isOpen.value"
            @click="toggleTodo"
          >
            {{ todoActionLabel }}
          </button>
        </div>
      </section>

      <button
        type="button"
        class="pet__character"
        :title="characterTitle"
        :aria-label="characterLabel"
        :aria-expanded="bubbleOpen"
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

        <!-- 旧 AI 起動ボタン（右下の円形ボタン）の役割。生成中と ToDo 件数をここで示す。
             状態を色だけで表現しない（CLAUDE.md §6-13）ため、必ず文字を添える -->
        <span
          v-if="aiTodo.available.value && (aiTodo.isLoading.value || todoCount > 0)"
          class="pet__ai"
          :class="{ 'pet__ai--loading': aiTodo.isLoading.value }"
        >
          <svg
            class="pet__ai-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 3.5 l1.9 4.6 l4.6 1.9 l-4.6 1.9 l-1.9 4.6 l-1.9-4.6 l-4.6-1.9 l4.6-1.9 z" />
          </svg>
          <span class="pet__ai-text">{{ aiTodo.isLoading.value ? "生成中" : `ToDo ${todoCount}` }}</span>
        </span>
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
  /* 切り抜き画像は表情ごとに縦横比が違う。contain のまま中央に置くと当たり判定の
     右と下に余白が残り、右下端に置いても浮いて見えるので隅へ寄せる */
  object-fit: contain;
  object-position: right bottom;
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

.pet__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.pet__action {
  padding: 5px 12px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: 700;
}

/* 通知の確認が主。ToDo は添えるだけなので面を張らない */
.pet__action--ghost {
  background: var(--color-canvas);
  color: var(--color-primary);
}

/* 旧 AI 起動ボタンの表示。らくす君の足元に小さく重ねる */
.pet__ai {
  position: absolute;
  right: 2px;
  bottom: 6px;
  display: inline-flex;
  gap: 3px;
  align-items: center;
  padding: 3px 8px 3px 6px;
  border: 1px solid var(--color-canvas);
  border-radius: var(--radius-pill);
  background-image: linear-gradient(135deg, var(--color-primary) 0%, #b64bff 100%);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-3);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.pet__ai-icon {
  width: 11px;
  height: 11px;
}

.pet__ai--loading .pet__ai-icon {
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
  .pet__image,
  .pet__ai-icon {
    animation: none;
    transition: none;
  }
}
</style>
