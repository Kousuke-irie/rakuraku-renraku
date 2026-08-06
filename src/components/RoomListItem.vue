<script setup>
// 受信箱一覧の1行（B-1・P1-1・P1-2・frontend.md §9）
//
// 表示項目は3段に固定する。**一覧性を最優先し、これ以上は増やさない。**
//   1段目：氏名＋対応ステータス＋時刻
//   2段目：最終メッセージ抜粋＋経過時間＋未読数
//   3段目：選考ステータス／用件タグ（P1-3 の「一覧行に選考段階が常に表示」を満たす）
// 大学名・担当人事は右ペイン（ProfilePanel）に置き、ここには出さない。
//
// AI推奨度は行の面の着色と補助文で表す。AI未判定時はルール判定をフォールバック
// として使うため、欠席・遅刻などの即時対応も一覧から見落とさない。
//
// **一覧行の見た目とふるまいはこのコンポーネントが単独で持つ。**
// InboxSidebar はヘッダ（検索・サマリー・フィルタ）とこの行の反復だけを担当する。
//
// 対応ステータスの**変更**は右ペイン（ProfilePanel）の責務。ここは表示のみ。
import { computed } from "vue"
import {
  AI_RECOMMENDED_PRIORITY,
  AI_RECOMMENDED_PRIORITY_META,
  AI_RECOMMENDED_PRIORITY_TITLE,
  LAST_MESSAGE_PREVIEW_LENGTH,
  SELECTION_STATUS_META,
  SCHEDULE_REQUEST_STATUS,
  SCHEDULE_REQUEST_STATUS_META,
  TOPIC_TAG_META,
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

const scheduleLabel = computed(() => {
  const request = props.room.scheduleRequest
  if (!request) return ""
  if (request.needsAttention) return "[要対応] 予約可能枠なし"
  if (request.status === SCHEDULE_REQUEST_STATUS.BOOKED && request.bookedStartsAt) {
    const date = new Date(request.bookedStartsAt).toLocaleString("ja-JP", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    })
    return `[日程確定] ${date}`
  }
  if (request.status === SCHEDULE_REQUEST_STATUS.EXPIRED) return "[要対応] 日程選択期限切れ"
  if (request.status === SCHEDULE_REQUEST_STATUS.WAITING_STUDENT) return "[日程調整] 学生日程選択待ち"
  return SCHEDULE_REQUEST_STATUS_META[request.status]?.label ?? ""
})

const isHighPriority = computed(
  () => (props.room.priority ?? props.room.urgency) === AI_RECOMMENDED_PRIORITY.HIGH,
)

/** 最終メッセージの抜粋（frontend.md §5：40文字で省略） */
const preview = computed(() => {
  const body = props.room.lastMessage?.body ?? ""
  return body.length > LAST_MESSAGE_PREVIEW_LENGTH
    ? `${body.slice(0, LAST_MESSAGE_PREVIEW_LENGTH)}…`
    : body
})

const showAiRecommendation = computed(() =>
  (props.room.priority ?? props.room.urgency) === AI_RECOMMENDED_PRIORITY.HIGH
)

const aiPriorityLabel = computed(
  () => AI_RECOMMENDED_PRIORITY_META[props.room.priority ?? props.room.urgency]?.label ?? ""
)

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
      'room--high': isHighPriority,
      'room--low': (room.priority ?? room.urgency) === AI_RECOMMENDED_PRIORITY.LOW,
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

        <p
          v-if="showAiRecommendation"
          class="room__ai"
          :title="room.aiRecommendation.reason"
        >
          {{ AI_RECOMMENDED_PRIORITY_TITLE }}：{{ aiPriorityLabel }}
          <span v-if="room.aiRecommendation.reason">・{{ room.aiRecommendation.reason }}</span>
        </p>

        <!-- 選考ステータス（P1-3）と用件タグ（P1-5）。チップにせず文字だけで置く -->
        <p class="room__meta">
          <span>{{ selectionLabel }}</span>
          <span
            class="room__sep"
            aria-hidden="true"
          >/</span>
          <span>{{ topicLabel }}</span>
          <span
            v-if="scheduleLabel"
            class="room__schedule"
            :class="{
              'room__schedule--alert':
                room.scheduleRequest?.status === SCHEDULE_REQUEST_STATUS.EXPIRED ||
                room.scheduleRequest?.needsAttention,
            }"
          >
            ・{{ scheduleLabel }}
          </span>
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

/* AI推奨度 high は行の面を淡い警告色にする。 */
.room--high .room__link {
  background-color: color-mix(in srgb, var(--color-sla-alert) 9%, var(--color-canvas));
}

.room--high .room__link:hover {
  background-color: color-mix(in srgb, var(--color-sla-alert) 14%, var(--color-canvas));
}

/* AI推奨度 low は行全体を薄く表示 */
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

.room__ai {
  overflow: hidden;
  margin: 3px 0 0;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
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

.room__schedule {
  overflow: hidden;
  color: var(--color-primary);
  font-weight: 700;
  text-overflow: ellipsis;
}

.room__schedule--alert {
  color: var(--color-error);
}
</style>
