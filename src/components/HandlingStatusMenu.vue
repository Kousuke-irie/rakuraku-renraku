<script setup>
// 対応ステータスの変更ドロップダウン（P1-2・frontend.md §6）
//
// 「一覧を離れずに2クリック以内で変更できる」ことが受入条件なので、
// チップ＝1クリック目（開く）／選択肢＝2クリック目（確定）の2階層に留める。
//
// 状態の更新は必ず roomsStore.updateHandlingStatus() を通す（楽観更新とロールバックの責務はストア側）。
// 開閉状態は uiStore が単一で持つので、一覧のどこかを開くと他は自動的に閉じる。
//
// 一覧行は RouterLink の中にあるため、このコンポーネント内のクリックは
// ルート要素で止めてトーク画面への遷移を防ぐ。
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { HANDLING_STATUS_META, HANDLING_STATUS_VALUES } from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"

const props = defineProps({
  roomId: { type: Number, required: true },
  /** 現在の対応ステータス（HANDLING_STATUS のいずれか） */
  value: { type: String, default: "" },
  /** StatusChip に渡すサイズ */
  size: { type: String, default: "sm" },
})

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region constants
/**
 * 開く向きの判定に使うメニューの想定高さ（px）。
 * 一覧は overflow-y:auto で切り取られるため、下に入りきらない行では上向きに開く。
 */
const MENU_ESTIMATED_HEIGHT = 176
// #endregion

// #region local state
/** @type {import('vue').Ref<HTMLElement|null>} 開く向きの判定に使う基準要素 */
const rootRef = ref(null)
/** @type {import('vue').Ref<HTMLElement[]>} 選択肢のボタン。開いたときのフォーカス移動に使う */
const optionRefs = ref([])
/** 下に入りきらないときだけ上向きに開く */
const dropUp = ref(false)
// #endregion

// #region computed
const isOpen = computed(() => ui.statusMenuRoomId === props.roomId)

const triggerLabel = computed(
  () => `対応ステータス（現在: ${HANDLING_STATUS_META[props.value]?.label ?? "未設定"}）`
)
// #endregion

// #region local methods
const close = () => ui.closeStatusMenu()

const toggle = () => {
  if (isOpen.value) {
    close()
    return
  }

  const rect = rootRef.value?.getBoundingClientRect()
  dropUp.value = Boolean(rect) && rect.bottom + MENU_ESTIMATED_HEIGHT > window.innerHeight
  ui.openStatusMenu(props.roomId)
}

const select = (status) => {
  close()
  rooms.updateHandlingStatus(props.roomId, status)
}

/** 開いている間だけ「外側クリック」「Escape」で閉じる */
const onDocumentClick = () => close()
const onDocumentKeydown = (event) => {
  if (event.key === "Escape") close()
}

const bindDismiss = () => {
  document.addEventListener("click", onDocumentClick)
  document.addEventListener("keydown", onDocumentKeydown)
}

const unbindDismiss = () => {
  document.removeEventListener("click", onDocumentClick)
  document.removeEventListener("keydown", onDocumentKeydown)
}
// #endregion

// #region lifecycle
watch(isOpen, async (open) => {
  if (!open) {
    unbindDismiss()
    return
  }

  bindDismiss()
  // キーボード操作でも選択肢へ入れるようにする（以降は Tab で移動できる）
  await nextTick()
  optionRefs.value[0]?.focus()
})

onBeforeUnmount(unbindDismiss)
// #endregion
</script>

<template>
  <!-- 行全体が RouterLink なので、ここでのクリックは遷移させない -->
  <div
    ref="rootRef"
    class="status-menu"
    @click.stop.prevent
  >
    <StatusChip
      :kind="CHIP_KIND.HANDLING"
      :value="value"
      :size="size"
      interactive
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-label="triggerLabel"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    />

    <ul
      v-if="isOpen"
      class="status-menu__list"
      :class="{ 'status-menu__list--up': dropUp }"
      role="menu"
    >
      <li
        v-for="status in HANDLING_STATUS_VALUES"
        :key="status"
        role="none"
      >
        <button
          ref="optionRefs"
          type="button"
          class="status-menu__option"
          :class="{ 'status-menu__option--active': status === value }"
          role="menuitemradio"
          :aria-checked="status === value"
          @click="select(status)"
        >
          <StatusChip
            :kind="CHIP_KIND.HANDLING"
            :value="status"
            size="sm"
          />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.status-menu {
  position: relative;
  display: inline-flex;
}

.status-menu__list {
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;
  padding: 4px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
  list-style: none;
}

/* 一覧の下端の行では上向きに開く（.rooms の overflow-y:auto に切られないため） */
.status-menu__list--up {
  top: auto;
  bottom: calc(100% + 4px);
}

.status-menu__option {
  display: flex;
  width: 100%;
  padding: 4px 6px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  background: none;
  text-align: left;
  cursor: pointer;
}

.status-menu__option:hover {
  background-color: color-mix(in srgb, var(--color-primary) 6%, var(--color-canvas));
}

.status-menu__option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* 現在のステータスは背景で示す（aria-checked と二重表現） */
.status-menu__option--active {
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-canvas));
}
</style>
