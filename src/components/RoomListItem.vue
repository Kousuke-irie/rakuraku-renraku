<script setup>
// 受信箱一覧の1行（B-1・P1-1・P1-2・frontend.md §9）
//
// 表示項目は3段に固定する。**一覧性を最優先し、これ以上は増やさない。**
//   1段目：氏名＋対応ステータス＋時刻
//   2段目：最終メッセージ抜粋＋経過時間＋未読数
//   3段目：選考ステータス／用件タグ（P1-3 の「一覧行に選考段階が常に表示」を満たす）
// 大学名・担当人事は右ペイン（ProfilePanel）に置き、ここには出さない。
//
// 緊急度は**行の面の着色だけ**で表す（P1-6）。チップも左バーも置かないことで、
// 段数を増やさずに「上から順に処理する」対象を目立たせる。
// 面の色は読み上げに乗らないため、ラベルは sr-only で残す（CLAUDE.md §6-13）。
//
// **一覧行の見た目とふるまいはこのコンポーネントが単独で持つ。**
// InboxSidebar はヘッダ（検索・サマリー・フィルタ）とこの行の反復だけを担当する。
//
// 対応ステータスの**変更**は右ペイン（ProfilePanel）の責務。ここは表示のみ。
import { computed } from "vue"
import {
  LAST_MESSAGE_PREVIEW_LENGTH,
  SELECTION_STATUS_META,
  TOPIC_TAG_META,
  URGENCY,
  URGENCY_META,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"
import ElapsedBadge from "./ElapsedBadge.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UnreadBadge from "./UnreadBadge.vue"
import UserAvatar from "./UserAvatar.vue"

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

const topicLabel = computed(() => TOPIC_TAG_META[props.room.topicTag]?.label ?? "")

/** 緊急（high）の行だけ面を着色し、テキストラベルを添える */
const isUrgent = computed(() => props.room.urgency === URGENCY.HIGH)
const urgentLabel = computed(() => URGENCY_META[URGENCY.HIGH].label)

/** 最終メッセージの抜粋（frontend.md §5：40文字で省略） */
const preview = computed(() => {
  const body = props.room.lastMessage?.body ?? ""
  return body.length > LAST_MESSAGE_PREVIEW_LENGTH
    ? `${body.slice(0, LAST_MESSAGE_PREVIEW_LENGTH)}…`
    : body
})

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
      'room--high': isUrgent,
      'room--low': room.urgency === URGENCY.LOW,
      'room--unread': room.unreadCount > 0,
    }"
  >
    <RouterLink
      class="room__link"
      :to="`/inbox/${room.id}`"
    >
      <UserAvatar
        :display-name="student.displayName ?? ''"
        :color="student.avatarColor ?? ''"
        size="md"
      />

      <div class="room__body">
        <div class="room__line">
          <!-- 面の色は読み上げに乗らないので、ラベルだけ sr-only で残す（CLAUDE.md §6-13） -->
          <span
            v-if="isUrgent"
            class="sr-only"
          >{{ urgentLabel }}</span>
          <span class="room__name">{{ student.displayName }}</span>
          <!-- 変更は右ペインで行うため、ここは現在値の表示だけ（P1-2） -->
          <StatusChip
            :kind="CHIP_KIND.HANDLING"
            :value="room.handlingStatus"
            size="sm"
          />
          <span class="room__time">{{ time }}</span>
        </div>

        <div class="room__line">
          <p class="room__preview">
            {{ preview }}
          </p>
          <ElapsedBadge
            :since="room.lastStudentMessageAt"
            :handling-status="room.handlingStatus"
          />
          <UnreadBadge :count="room.unreadCount ?? 0" />
        </div>

        <!-- 選考ステータス（P1-3）と用件タグ（P1-5）。チップにせず文字だけで置く -->
        <p class="room__meta">
          <span>{{ selectionLabel }}</span>
          <span
            class="room__sep"
            aria-hidden="true"
          >/</span>
          <span>{{ topicLabel }}</span>
        </p>
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
  align-items: flex-start;
  padding: var(--space-md) var(--space-lg);
  color: inherit;
  text-decoration: none;
}

.room__link:hover {
  background-color: color-mix(in srgb, var(--color-primary) 4%, var(--color-canvas));
}

/* 緊急（high）は行の面を淡い警告色にする。
   面だけで緊急を伝えるので、他の行と一目で分かる濃さを持たせる（P1-6） */
.room--high .room__link {
  background-color: color-mix(in srgb, var(--color-sla-alert) 9%, var(--color-canvas));
}

.room--high .room__link:hover {
  background-color: color-mix(in srgb, var(--color-sla-alert) 14%, var(--color-canvas));
}

/* 緊急度 low は行全体を薄く表示（frontend.md §6） */
.room--low .room__link {
  opacity: 0.62;
}

/* 選択中の行はブランド色で示す（DESIGN.md：オレンジは CTA とアクティブ状態のみ）。
   緊急の面より優先させたいので、.room--high の後に書く */
.room--active .room__link,
.room--active .room__link:hover {
  background-color: color-mix(in srgb, var(--color-primary) 7%, var(--color-canvas));
  box-shadow: inset 3px 0 0 var(--color-primary);
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

.room__line + .room__line {
  margin-top: 2px;
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
  flex: none;
  margin-left: auto;
  color: var(--color-ink-mute);
  font-size: 11px;
  white-space: nowrap;
}

.room__preview {
  flex: 1 1 auto;
  overflow: hidden;
  min-width: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room__meta {
  display: flex;
  gap: var(--space-xs);
  overflow: hidden;
  margin-top: 3px;
  color: var(--color-ink-mute);
  font-size: 11px;
  white-space: nowrap;
}

.room__sep {
  color: var(--color-hairline);
}
</style>
