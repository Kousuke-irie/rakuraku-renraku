<script setup>
// 受信箱一覧1行（B-1・P1-1・frontend.md §9）
// ①氏名＋大学名 ②選考ステータスラベル ③最終メッセージ抜粋 ④経過時間バッジ ⑤未読数バッジ
// ⑥対応ステータスチップ を実装。⑦〜⑧（担当者・ピン留め）は次のステップ以降で追加する。
//
// ⑥のドロップダウンによるステータス変更（P1-2）は RoomListItem の責務（frontend.md §9）。
import { computed } from "vue"
import {
  HANDLING_STATUS_VALUES,
  LAST_MESSAGE_PREVIEW_LENGTH,
  SELECTION_STATUS_META,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import ElapsedBadge from "./ElapsedBadge.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UnreadBadge from "./UnreadBadge.vue"

const props = defineProps({
  room: { type: Object, required: true },
})

const rooms = useRoomsStore()
const ui = useUiStore()

const selectionLabel = computed(
  () => SELECTION_STATUS_META[props.room.student?.selectionStatus]?.label ?? ""
)

/** 最終メッセージの抜粋（frontend.md §5：40文字で省略） */
const preview = computed(() => {
  const body = props.room.lastMessage?.body ?? ""
  return body.length > LAST_MESSAGE_PREVIEW_LENGTH
    ? `${body.slice(0, LAST_MESSAGE_PREVIEW_LENGTH)}…`
    : body
})

// #region 対応ステータスのドロップダウン（P1-2）
const statusMenuOpen = computed(() => ui.statusMenuRoomId === props.room.id)

const toggleStatusMenu = () => {
  if (statusMenuOpen.value) ui.closeStatusMenu()
  else ui.openStatusMenu(props.room.id)
}

/** 一覧を離れず2クリック以内で変更できること（requirements.md P1-2 受入条件） */
const selectHandlingStatus = (status) => {
  rooms.updateHandlingStatus(props.room.id, status)
  ui.closeStatusMenu()
}
// #endregion
</script>

<template>
  <div class="room-list-item">
    <p class="room-list-item__name">
      {{ room.student?.displayName }}
    </p>
    <p class="room-list-item__affiliation">
      <span>{{ room.student?.university }}</span>
      <span
        class="room-list-item__dot"
        aria-hidden="true"
      >/</span>
      <span>{{ selectionLabel }}</span>
    </p>
    <p class="room-list-item__preview">
      {{ preview }}
    </p>
    <div class="room-list-item__foot">
      <!-- ⑥ 対応ステータスチップ。クリックでドロップダウン→1クリックで変更（P1-2） -->
      <div class="room-list-item__status">
        <StatusChip
          :kind="CHIP_KIND.HANDLING"
          :value="room.handlingStatus"
          size="sm"
          interactive
          @click="toggleStatusMenu"
          @keydown.enter="toggleStatusMenu"
        />
        <ul
          v-if="statusMenuOpen"
          class="room-list-item__status-menu"
        >
          <li
            v-for="status in HANDLING_STATUS_VALUES"
            :key="status"
          >
            <button
              type="button"
              class="room-list-item__status-option"
              :class="{ 'room-list-item__status-option--active': status === room.handlingStatus }"
              @click="selectHandlingStatus(status)"
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

      <ElapsedBadge
        :since="room.lastStudentMessageAt"
        :handling-status="room.handlingStatus"
      />
      <UnreadBadge
        class="room-list-item__unread"
        :count="room.unreadCount ?? 0"
      />
    </div>
  </div>
</template>

<style scoped>
.room-list-item {
  padding: 8px 12px;
}

.room-list-item__name {
  font-size: 14px;
  font-weight: 700;
}

.room-list-item__affiliation {
  display: flex;
  gap: 4px;
  margin-top: 2px;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.room-list-item__dot {
  color: var(--color-hairline);
}

.room-list-item__preview {
  overflow: hidden;
  margin-top: 2px;
  color: var(--color-ink-mute);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-list-item__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}

/* 未読バッジは行の右端に置く（frontend.md §6） */
.room-list-item__unread {
  margin-left: auto;
}

.room-list-item__status {
  position: relative;
}

.room-list-item__status-menu {
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

.room-list-item__status-option {
  display: flex;
  width: 100%;
  padding: 4px 6px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  background: none;
  text-align: left;
  cursor: pointer;
}

.room-list-item__status-option:hover {
  background-color: color-mix(in srgb, var(--color-primary) 6%, var(--color-canvas));
}

.room-list-item__status-option--active {
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-canvas));
}
</style>
