<script setup>
// ホームの学生一覧テーブル（S-07・frontend.md §5-2）
//
// 1行＝1学生。行クリックで /inbox/:roomId（S-04）へ渡し、**このテーブルでは返信しない**。
//
// ★`<table>` ではなく grid ＋ ARIA ロールで組んでいる。
//   行全体をクリック領域にしたいが、`<tr>` に click ハンドラを付けるとキーボードで辿れない。
//   行を RouterLink にすればフォーカス・Enter・中クリックが標準の挙動で手に入る。
//
// ★対応ステータスのドロップダウン変更（P1-2）はここでは行わない。
//   受信箱（RoomListItem）の責務なので、ここは表示専用のチップに留める。
import { computed } from "vue"
import {
  LAST_MESSAGE_PREVIEW_LENGTH,
  SELECTION_STATUS_META,
  TOPIC_TAG,
  URGENCY,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import ElapsedBadge from "./ElapsedBadge.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UnreadBadge from "./UnreadBadge.vue"
import UrgencyBar from "./UrgencyBar.vue"
import UserAvatar from "./UserAvatar.vue"

// #region constants
/** 列見出し。grid-template-columns と並び順を必ず揃える */
const COLUMNS = Object.freeze([
  "学生名／大学・学部",
  "選考ステータス",
  "対応状況",
  "最新メッセージ",
  "経過時間",
])

const EMPTY_TEXT = "対応が必要な学生はいません 🎉"
// #endregion

// #region global state
const rooms = useRoomsStore()
// #endregion

// #region local methods
/** 最終メッセージの抜粋（frontend.md §5：40文字で省略） */
const previewOf = (room) => {
  const body = room.lastMessage?.body ?? ""
  return body.length > LAST_MESSAGE_PREVIEW_LENGTH
    ? `${body.slice(0, LAST_MESSAGE_PREVIEW_LENGTH)}…`
    : body
}

const selectionLabelOf = (room) => SELECTION_STATUS_META[room.student?.selectionStatus]?.label ?? ""

/** 大学と学部。どちらか欠けていても区切り文字が浮かないようにする */
const affiliationOf = (room) =>
  [room.student?.university, room.student?.faculty].filter(Boolean).join(" ")

/** その他タグは情報量がないので出さない（行のノイズを減らす） */
const hasTopicTag = (room) => Boolean(room.topicTag) && room.topicTag !== TOPIC_TAG.OTHER
// #endregion

// #region computed
/**
 * 並びはサーバの既定順（ピン留め → 緊急度 → 経過時間）をそのまま使う。
 * ★P1-7 で roomsStore.sortedRooms が実装されたらそちらへ差し替えること。
 */
const roomList = computed(() => rooms.rooms)
// #endregion
</script>

<template>
  <div
    class="table"
    role="table"
    aria-label="学生一覧"
  >
    <div
      class="table__head row"
      role="row"
    >
      <span
        v-for="column in COLUMNS"
        :key="column"
        class="table__th"
        role="columnheader"
      >{{ column }}</span>
    </div>

    <p
      v-if="roomList.length === 0"
      class="table__empty"
    >
      {{ EMPTY_TEXT }}
    </p>

    <div
      v-else
      class="table__body"
      role="rowgroup"
    >
      <RouterLink
        v-for="room in roomList"
        :key="room.id"
        class="row row--link"
        :class="{
          'row--low': room.urgency === URGENCY.LOW,
          'row--unread': room.unreadCount > 0,
        }"
        :to="`/inbox/${room.id}`"
        role="row"
      >
        <!-- 学生名／大学・学部 -->
        <span
          class="cell cell--student"
          role="cell"
        >
          <!-- 緊急度は左端のバー（色）＋チップのテキストの二重表現（CLAUDE.md §6-13） -->
          <UrgencyBar
            class="cell__urgency"
            :urgency="room.urgency"
            :show-label="false"
          />
          <UserAvatar
            :display-name="room.student?.displayName ?? ''"
            :color="room.student?.avatarColor ?? ''"
            size="lg"
          />
          <span class="student">
            <span class="student__line">
              <span
                v-if="room.isPinned"
                class="student__pin"
                aria-label="ピン留め"
              >📌</span>
              <span class="student__name">{{ room.student?.displayName }}</span>
              <StatusChip
                v-if="room.urgency !== URGENCY.NORMAL"
                :kind="CHIP_KIND.URGENCY"
                :value="room.urgency"
                size="sm"
              />
              <UnreadBadge :count="room.unreadCount ?? 0" />
            </span>
            <span class="student__affiliation">{{ affiliationOf(room) }}</span>
          </span>
        </span>

        <!-- 選考ステータス -->
        <span
          class="cell"
          role="cell"
        >
          <span class="selection">{{ selectionLabelOf(room) }}</span>
        </span>

        <!-- 対応状況（対応ステータス＋用件タグ） -->
        <span
          class="cell cell--handling"
          role="cell"
        >
          <StatusChip
            :kind="CHIP_KIND.HANDLING"
            :value="room.handlingStatus"
          />
          <StatusChip
            v-if="hasTopicTag(room)"
            :kind="CHIP_KIND.TOPIC"
            :value="room.topicTag"
            size="sm"
          />
        </span>

        <!-- 最新メッセージ -->
        <span
          class="cell"
          role="cell"
        >
          <span class="preview">{{ previewOf(room) }}</span>
        </span>

        <!-- 経過時間 -->
        <span
          class="cell cell--elapsed"
          role="cell"
        >
          <ElapsedBadge
            :since="room.lastStudentMessageAt"
            :handling-status="room.handlingStatus"
          />
        </span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.table {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

/* 見出しと行で同じ定義を使う。ズレると列が揃わないので必ずここ1箇所で持つ */
.row {
  display: grid;
  grid-template-columns: minmax(220px, 1.6fr) 108px minmax(160px, 1fr) minmax(180px, 1.6fr) 116px;
  gap: var(--space-md);
  align-items: center;
}

.table__head {
  flex: none;
  padding: var(--space-sm) var(--space-xl);
  border-bottom: 1px solid var(--color-hairline);
}

.table__th {
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* 経過時間は右寄せの値なので、見出しも揃える */
.table__th:last-child {
  text-align: right;
}

.table__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* AI パネルを閉じるとテーブルが全幅になり、最終行が右下の AI ボタンに隠れる。
     スクロールしきったときに最終行が読めるよう、下端を空けておく */
  padding-bottom: var(--ai-fab-clearance);
}

.table__empty {
  padding: var(--space-huge) var(--space-xl);
  color: var(--color-ink-mute);
  font-size: 14px;
  text-align: center;
}

/* 見出しと同じ左右 padding にする。ズラすと grid の列が見出しと揃わない
   （緊急度バーだけは負のマージンで padding の外へ出し、行の左端に貼り付ける） */
.row--link {
  padding: var(--space-md) var(--space-xl);
  color: inherit;
  text-decoration: none;
}

.row--link + .row--link {
  border-top: 1px solid var(--color-hairline);
}

.row--link:hover {
  background-color: color-mix(in srgb, var(--color-primary) 4%, var(--color-canvas));
}

/* 緊急度 low は行全体を薄く表示（frontend.md §6） */
.row--low {
  opacity: 0.62;
}

.cell {
  min-width: 0;
}

.cell--student {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  align-self: stretch;
}

/* バーを行の高さいっぱいに伸ばし（親の align-items: stretch）、
   行の padding の外＝カードの左端に貼り付ける */
.cell__urgency {
  flex: none;
  align-self: stretch;
  margin-right: var(--space-md);
  margin-left: calc(var(--space-xl) * -1);
}

.student {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.student__line {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.student__pin {
  flex: none;
  font-size: 11px;
  line-height: 1;
}

.student__name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 未読がある行はタイトルを太字にする（frontend.md §6） */
.row--unread .student__name {
  font-weight: 700;
}

.student__affiliation {
  overflow: hidden;
  color: var(--color-ink-mute);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--color-ink) 5%, var(--color-canvas));
  color: var(--color-ink);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.cell--handling {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  align-items: center;
}

.preview {
  display: block;
  overflow: hidden;
  color: var(--color-ink-mute);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell--elapsed {
  display: flex;
  justify-content: flex-end;
}
</style>
