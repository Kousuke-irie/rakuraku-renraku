<script setup>
// AI 現況サマリー／今日の ToDo の浮遊パネル（P3-1a）。
//
// もとはホーム（S-07）の右カラムに固定した列だったが、
// **どの画面からでも ToDo を聞けるように**、AppShell 直下の浮遊パネルへ移した。
// 入口はらくす君（RakusuKunPet）で、らくす君を隠している間だけ AiLauncherButton が代わる。
//
// ★AppShell は overflow: hidden なので、通常フローではなく position: fixed で画面に固定する。
// ★立ち位置はらくす君の隣。らくす君はドラッグで動くので、その足元へ下端を合わせて上へ伸ばす。
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import AiSummaryCard from "./AiSummaryCard.vue"
import { useAiTodo } from "../composables/useAiTodo.js"
import { useUiStore } from "../stores/ui.js"
import {
  AI_FAB_SIZE,
  clampToViewport,
  defaultPetPosition,
  petBoxSize,
  VIEWPORT_MARGIN,
} from "../utils/petLayout.js"

// #region constants
const PANEL_WIDTH = 340
/** らくす君とパネルの間隔。吹き出しに見えるくらいには近づける */
const PANEL_GAP = 12
/** ToDo は最大3件。これ以上背を伸ばしても余白が増えるだけ */
const PANEL_MAX_HEIGHT = 560
/** AiLauncherButton の画面端からの余白（--space-xxl と揃える） */
const FAB_MARGIN = 24
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
const aiTodo = useAiTodo()
const viewport = ref({ width: 0, height: 0 })
// #endregion

// #region computed
const isOpen = computed(() => aiTodo.available.value && aiTodo.isOpen.value)

/** パネルを寄り添わせる相手。らくす君を隠している間は代替の円形ボタン */
const anchorBox = computed(() => {
  const view = viewport.value
  if (!ui.petVisible) {
    return {
      x: view.width - AI_FAB_SIZE - FAB_MARGIN,
      y: view.height - AI_FAB_SIZE - FAB_MARGIN,
      width: AI_FAB_SIZE,
      height: AI_FAB_SIZE,
    }
  }
  const size = petBoxSize(ui.petMinimized)
  const position = clampToViewport(ui.petPosition ?? defaultPetPosition(view), size, view)
  return { ...position, ...size }
})

const panelStyle = computed(() => {
  const view = viewport.value
  const box = anchorBox.value

  // 左に置くのが基本。入らなければ右へ回し、どちらも無理なら画面内へ寄せる
  const leftSide = box.x - PANEL_WIDTH - PANEL_GAP
  const rightSide = box.x + box.width + PANEL_GAP
  const preferred =
    leftSide >= VIEWPORT_MARGIN || rightSide + PANEL_WIDTH + VIEWPORT_MARGIN > view.width
      ? leftSide
      : rightSide
  const maxLeft = Math.max(VIEWPORT_MARGIN, view.width - PANEL_WIDTH - VIEWPORT_MARGIN)
  const left = Math.min(Math.max(VIEWPORT_MARGIN, preferred), maxLeft)

  // 縦は伸びしろが大きい側へ。らくす君が上に居るときに足元へ揃えると、
  // 上に残った僅かな高さへ押し込められて中身が潰れる（実測で踏んだ）
  const spaceAbove = box.y + box.height - VIEWPORT_MARGIN
  const spaceBelow = view.height - box.y - VIEWPORT_MARGIN
  const vertical =
    spaceAbove >= spaceBelow
      ? { bottom: `${Math.max(VIEWPORT_MARGIN, view.height - box.y - box.height)}px`, top: "auto" }
      : { top: `${Math.max(VIEWPORT_MARGIN, box.y)}px`, bottom: "auto" }

  return {
    left: `${left}px`,
    ...vertical,
    width: `${PANEL_WIDTH}px`,
    maxHeight: `${Math.min(PANEL_MAX_HEIGHT, Math.max(spaceAbove, spaceBelow))}px`,
  }
})
// #endregion

// #region browser event handler
const onResize = () => {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
}

const onKeydown = (event) => {
  if (event.key === "Escape" && isOpen.value) aiTodo.close()
}
// #endregion

// #region lifecycle
// 開く直前に測り直す。マウント時点では画面の寸法がまだ 0 のことがあり、
// そのまま使うと立ち位置が画面外へ飛ぶ
watch(isOpen, (open) => {
  if (open) onResize()
})

onMounted(() => {
  onResize()
  window.addEventListener("resize", onResize)
  window.addEventListener("keydown", onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize)
  window.removeEventListener("keydown", onKeydown)
})
// #endregion
</script>

<template>
  <div
    v-if="isOpen"
    class="ai-todo"
    :style="panelStyle"
  >
    <AiSummaryCard class="ai-todo__card" />
  </div>
</template>

<style scoped>
/* らくす君（z-index: 90）より下、けれどページの中身より上に重ねる */
.ai-todo {
  position: fixed;
  z-index: 80;
  display: flex;
  flex-direction: column;
  min-height: 0;
  animation: ai-todo-in 160ms ease-out;
}

/* max-height はこの入れ物が持つ。中身が短ければカードも短く、
   溢れたぶんは flex の縮小 → 本文（.ai-card__body）のスクロールで吸収する */
.ai-todo__card {
  height: auto;
  min-height: 0;
  box-shadow: var(--shadow-2);
}

@keyframes ai-todo-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-todo {
    animation: none;
  }
}
</style>
