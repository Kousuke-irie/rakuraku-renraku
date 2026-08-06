<script setup>
// 受信箱一覧の1行（B-1・P1-1・P1-2・frontend.md §9）
//
// 表示項目：①氏名＋大学名 ②選考ステータスラベル ③最終メッセージ抜粋 ④経過時間バッジ
// ⑤未読数バッジ ⑥対応ステータスチップ ⑦担当者 ⑧ピン留めアイコン
//
// **一覧行の見た目とふるまいはこのコンポーネントが単独で持つ。**
// InboxSidebar はヘッダ（検索・サマリー・フィルタ）とこの行の反復だけを担当する。
// P1-7・P1-8・P2-8・P2-9 で行に項目が増えるときも、追加先はここに限定すること。
//
// ⑥のドロップダウンによるステータス変更（P1-2）は HandlingStatusMenu に委ねる。
import { computed } from "vue"
import {
  LAST_MESSAGE_PREVIEW_LENGTH,
  SELECTION_STATUS_META,
  URGENCY,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"
import ElapsedBadge from "./ElapsedBadge.vue"
import HandlingStatusMenu from "./HandlingStatusMenu.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UnreadBadge from "./UnreadBadge.vue"
import UrgencyBar from "./UrgencyBar.vue"
import UserAvatar from "./UserAvatar.vue"

// #region constants
const UNASSIGNED_LABEL = "未割当"
// #endregion

const props = defineProps({
  /** rooms ストアの room（stores/rooms.js の JSDoc 参照） */
  room: { type: Object, required: true },
})

// #region global state
const ui = useUiStore()
// #endregion

// #region computed
const student = computed(() => props.room.student ?? {})

const selectionLabel = computed(
  () => SELECTION_STATUS_META[student.value.selectionStatus]?.label ?? ""
)

/** 最終メッセージの抜粋（frontend.md §5：40文字で省略） */
const preview = computed(() => {
  const body = props.room.lastMessage?.body ?? ""
  return body.length > LAST_MESSAGE_PREVIEW_LENGTH
    ? `${body.slice(0, LAST_MESSAGE_PREVIEW_LENGTH)}…`
    : body
})

/**
 * この行の対応ステータスのドロップダウンが開いているか。
 * 開いている間は行の淡色化（緊急度 low）を解除して選択肢を読めるようにする。
 */
const isStatusMenuOpen = computed(() => ui.statusMenuRoomId === props.room.id)

/** 保存・送受信は UTC、表示のみローカル変換（CLAUDE.md §6-2） */
const time = computed(() => {
  const createdAt = props.room.lastMessage?.createdAt
  if (!createdAt) return ""

  const date = new Date(createdAt)
  const isToday = date.toDateString() === new Date().toDateString()
  return isToday
    ? date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
})
// #endregion
</script>

<template>
  <li
    class="room"
    :class="{
      'room--active': room.id === ui.selectedRoomId,
      'room--low': room.urgency === URGENCY.LOW,
      'room--unread': room.unreadCount > 0,
      'room--menu-open': isStatusMenuOpen,
    }"
  >
    <RouterLink
      class="room__link"
      :to="`/inbox/${room.id}`"
    >
      <!-- 緊急度は左端のバー（色）＋下段のテキストラベルの二重表現（CLAUDE.md §6-13） -->
      <UrgencyBar
        :urgency="room.urgency"
        :show-label="false"
      />

      <UserAvatar
        :display-name="student.displayName ?? ''"
        :color="student.avatarColor ?? ''"
        size="md"
      />

      <div class="room__body">
        <div class="room__line">
          <span
            v-if="room.isPinned"
            class="room__pin"
            aria-label="ピン留め"
          >📌</span>
          <span class="room__name">{{ student.displayName }}</span>
          <span class="room__time">{{ time }}</span>
        </div>

        <p class="room__affiliation">
          <span>{{ student.university }}</span>
          <span
            class="room__dot"
            aria-hidden="true"
          >/</span>
          <span>{{ selectionLabel }}</span>
        </p>

        <p class="room__preview">
          {{ preview }}
        </p>

        <div class="room__foot">
          <!-- ⑥ 対応ステータス。クリックでドロップダウン→1クリックで変更（P1-2） -->
          <HandlingStatusMenu
            :room-id="room.id"
            :value="room.handlingStatus"
            size="sm"
          />
          <StatusChip
            v-if="room.urgency !== URGENCY.NORMAL"
            :kind="CHIP_KIND.URGENCY"
            :value="room.urgency"
            size="sm"
          />
          <ElapsedBadge
            :since="room.lastStudentMessageAt"
            :handling-status="room.handlingStatus"
          />
          <span
            class="room__assignee"
            :class="{ 'room__assignee--unassigned': !room.assignee }"
          >{{ room.assignee?.displayName ?? UNASSIGNED_LABEL }}</span>
          <UnreadBadge :count="room.unreadCount ?? 0" />
        </div>
      </div>
    </RouterLink>
  </li>
</template>

<style scoped>
.room + .room {
  border-top: 1px solid var(--color-hairline);
}

.room__link {
  display: flex;
  gap: var(--space-sm);
  align-items: stretch;
  padding: var(--space-md) var(--space-lg);
  color: inherit;
  text-decoration: none;
}

.room__link:hover {
  background-color: color-mix(in srgb, var(--color-primary) 4%, var(--color-canvas));
}

/* 選択中の行はブランド色で示す（DESIGN.md：オレンジは CTA とアクティブ状態のみ） */
.room--active .room__link {
  background-color: color-mix(in srgb, var(--color-primary) 7%, var(--color-canvas));
  box-shadow: inset 3px 0 0 var(--color-primary);
}

/* 緊急度 low は行全体を薄く表示（frontend.md §6） */
.room--low .room__link {
  opacity: 0.62;
}

/* opacity は子孫にまとめて掛かり、内側だけ不透明に戻せない。
   ステータスを選んでいる間は選択肢が読めないと困るので、行ごと不透明に戻す（P1-2） */
.room--low.room--menu-open .room__link {
  opacity: 1;
}

.room__body {
  flex: 1 1 auto;
  min-width: 0;
}

.room__line {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
}

.room__pin {
  font-size: 11px;
  line-height: 1;
}

.room__name {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 未読がある行はタイトルを太字にする（frontend.md §6） */
.room--unread .room__name {
  font-weight: 700;
}

.room__time {
  margin-left: auto;
  color: var(--color-ink-mute);
  font-size: 11px;
  white-space: nowrap;
}

.room__affiliation {
  display: flex;
  gap: var(--space-xs);
  overflow: hidden;
  color: var(--color-ink-mute);
  font-size: 11px;
  white-space: nowrap;
}

.room__dot {
  color: var(--color-hairline);
}

.room__preview {
  overflow: hidden;
  margin-top: 2px;
  color: var(--color-ink-mute);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room__foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  align-items: center;
  margin-top: var(--space-sm);
}

.room__assignee {
  margin-left: auto;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  color: var(--color-ink-mute);
  font-size: 11px;
  white-space: nowrap;
}

/* 未アサインは警告色の枠で示す（frontend.md §6 / P2-9） */
.room__assignee--unassigned {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 700;
}
</style>
