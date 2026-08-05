<script setup>
// 受信箱の左ペイン（frontend.md §5 のレイアウト枠）
//
// ★このコンポーネントは**表示専用のガワ**である。
//   トーク画面（B-2）の見た目を確認できるようにするために置いてあり、
//   検索・サマリークリック・フィルタ・ソート・ステータス変更は**すべて非活性**。
//   P1-1（RoomListItem）／P1-7（FilterBar）／P1-8（SummaryBar）で
//   それぞれのコンポーネントに置き換えること。件数の算出も P1-8 で
//   GET /api/summary（roomsStore.summary）へ寄せる。
import { computed } from "vue"
import {
  ELAPSED_BADGE_HIDDEN_STATUSES,
  HANDLING_STATUS,
  LAST_MESSAGE_PREVIEW_LENGTH,
  SELECTION_STATUS_META,
  SLA_ALERT_HOURS,
  SORT_KEY_META,
  URGENCY,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import ElapsedBadge from "./ElapsedBadge.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UnreadBadge from "./UnreadBadge.vue"
import UrgencyBar from "./UrgencyBar.vue"
import UserAvatar from "./UserAvatar.vue"

// #region constants
/** 絞り込みの種別。P1-7 で FilterBar に置き換わるまでの見た目だけの並び */
const FILTER_LABELS = ["対応", "選考", "タグ", "緊急度", "担当"]
const UNASSIGNED_LABEL = "未割当"
// #endregion

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region local methods
/** 経過時間バッジを出す対象か（返信済み・完了は SLA の対象外・constants.md §9） */
const isOverdue = (room) =>
  !ELAPSED_BADGE_HIDDEN_STATUSES.includes(room.handlingStatus) &&
  (room.elapsedHours ?? 0) >= SLA_ALERT_HOURS

/** 最終メッセージの抜粋（frontend.md §5：40文字で省略） */
const previewOf = (room) => {
  const body = room.lastMessage?.body ?? ""
  return body.length > LAST_MESSAGE_PREVIEW_LENGTH
    ? `${body.slice(0, LAST_MESSAGE_PREVIEW_LENGTH)}…`
    : body
}

// 保存・送受信は UTC、表示のみローカル変換（CLAUDE.md §6-2）
const timeOf = (room) => {
  const createdAt = room.lastMessage?.createdAt
  if (!createdAt) return ""

  const date = new Date(createdAt)
  const isToday = date.toDateString() === new Date().toDateString()
  return isToday
    ? date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
}

const selectionLabelOf = (room) =>
  SELECTION_STATUS_META[room.student?.selectionStatus]?.label ?? ""
// #endregion

// #region computed
/** 一覧の並びはサーバが既定順（ピン→緊急度→経過時間）で返す。並べ替えUIは P1-7 */
const roomList = computed(() => rooms.rooms)

/** P1-8 で GET /api/summary に置き換える暫定集計 */
const summaryItems = computed(() => [
  {
    key: "needsReply",
    label: "要返信",
    count: roomList.value.filter((room) => room.handlingStatus === HANDLING_STATUS.NEEDS_REPLY)
      .length,
  },
  {
    key: "urgent",
    label: "緊急",
    count: roomList.value.filter((room) => room.urgency === URGENCY.HIGH).length,
  },
  {
    key: "overdue24h",
    label: `${SLA_ALERT_HOURS}h超`,
    count: roomList.value.filter(isOverdue).length,
  },
])

const sortLabel = computed(() => SORT_KEY_META[rooms.sortKey]?.label ?? "")
// #endregion
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__head">
      <div class="sidebar__title-row">
        <h2 class="sidebar__title">
          受信箱
        </h2>
        <span class="sidebar__count">{{ roomList.length }}件</span>
      </div>

      <input
        class="sidebar__search"
        type="search"
        placeholder="氏名・大学で検索"
        disabled
      >

      <!-- サマリーバー（P1-8）：件数は実データ、クリックでの絞り込みは未実装 -->
      <ul class="summary">
        <li
          v-for="item in summaryItems"
          :key="item.key"
          class="summary__item"
        >
          <span class="summary__label">{{ item.label }}</span>
          <span class="summary__count">{{ item.count }}</span>
        </li>
      </ul>

      <!-- フィルタ＆ソート（P1-7）：形のみ -->
      <div class="filters">
        <button
          v-for="label in FILTER_LABELS"
          :key="label"
          type="button"
          class="filters__chip"
          disabled
        >
          {{ label }} ▾
        </button>
        <span class="filters__sort">{{ sortLabel }} ▾</span>
      </div>
    </div>

    <p
      v-if="roomList.length === 0"
      class="sidebar__empty"
    >
      対応が必要な学生はいません 🎉
    </p>

    <ol class="rooms">
      <li
        v-for="room in roomList"
        :key="room.id"
        class="room"
        :class="{
          'room--active': room.id === ui.selectedRoomId,
          'room--low': room.urgency === URGENCY.LOW,
          'room--unread': room.unreadCount > 0,
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
            :display-name="room.student?.displayName ?? ''"
            :color="room.student?.avatarColor ?? ''"
            size="md"
          />

          <div class="room__body">
            <div class="room__line">
              <span
                v-if="room.isPinned"
                class="room__pin"
                aria-label="ピン留め"
              >📌</span>
              <span class="room__name">{{ room.student?.displayName }}</span>
              <span class="room__time">{{ timeOf(room) }}</span>
            </div>

            <p class="room__affiliation">
              <span>{{ room.student?.university }}</span>
              <span
                class="room__dot"
                aria-hidden="true"
              >/</span>
              <span>{{ selectionLabelOf(room) }}</span>
            </p>

            <p class="room__preview">
              {{ previewOf(room) }}
            </p>

            <div class="room__foot">
              <StatusChip
                :kind="CHIP_KIND.HANDLING"
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
    </ol>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background-color: var(--color-canvas);
}

.sidebar__head {
  flex: none;
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  border-bottom: 1px solid var(--color-hairline);
}

.sidebar__title-row {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
}

.sidebar__title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02px;
}

.sidebar__count {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.sidebar__search {
  width: 100%;
  margin-top: var(--space-md);
  padding: 8px 12px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 13px;
}

.summary {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  list-style: none;
}

.summary__item {
  display: flex;
  flex: 1 1 0;
  gap: var(--space-xs);
  align-items: center;
  justify-content: center;
  padding: var(--space-sm) var(--space-xs);
  border-radius: var(--radius-md);
  background-color: var(--color-orange-soft);
}

.summary__label {
  color: var(--color-ink-mute);
  font-size: 11px;
}

.summary__count {
  font-size: 14px;
  font-weight: 700;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  align-items: center;
  margin-top: var(--space-md);
}

.filters__chip {
  padding: 3px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
  font-size: 11px;
}

.filters__sort {
  margin-left: auto;
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
}

.sidebar__empty {
  padding: var(--space-xxl) var(--space-lg);
  color: var(--color-ink-mute);
  font-size: 13px;
  text-align: center;
}

.rooms {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
}

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
