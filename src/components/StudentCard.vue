<script setup>
// ホームのボードに並ぶ学生カード1枚（S-07・frontend.md §5-2）
//
// 載せるのは アイコン／氏名／残りのステータス／経過時間／新着の有無 だけ。
// 大学名・最新メッセージは**載せない**（縦に並べたときに1枚が高くなり、
// 「上から順に処理する」という俯瞰性が落ちるため）。
//
// カード全体が /inbox/:roomId へのリンク。クリック領域を広く取りたいが
// div に @click を付けるとキーボードで辿れないので RouterLink にする。
import { computed } from "vue"
import { BOARD_GROUP_BY, URGENCY } from "../constants/index.js"
import ElapsedBadge from "./ElapsedBadge.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UnreadBadge, { UNREAD_VARIANT } from "./UnreadBadge.vue"
import UserAvatar from "./UserAvatar.vue"

// #region constants
/**
 * カードに出せるステータスの一覧。縦割りに使っている軸はここから除外する。
 * BOARD_GROUP_BY の値は CHIP_KIND と揃えてあるので、軸の判定にそのまま使える。
 */
const CHIPS = Object.freeze([
  { axis: BOARD_GROUP_BY.HANDLING, kind: CHIP_KIND.HANDLING, field: "handlingStatus" },
  { axis: BOARD_GROUP_BY.SELECTION, kind: CHIP_KIND.SELECTION, field: "selectionStatus" },
  { axis: BOARD_GROUP_BY.URGENCY, kind: CHIP_KIND.URGENCY, field: "urgency" },
])
// #endregion

const props = defineProps({
  /** roomsStore.rooms の要素 */
  room: { type: Object, required: true },
  /** 縦割りに使っている軸（BOARD_GROUP_BY のいずれか）。この軸のチップは出さない */
  groupBy: { type: String, required: true },
})

// #region computed
/** 選考ステータスだけ room ではなく room.student にぶら下がっている */
const valueOf = (field) =>
  field === "selectionStatus" ? props.room.student?.selectionStatus : props.room[field]

const chips = computed(() =>
  CHIPS.filter((chip) => chip.axis !== props.groupBy).map((chip) => ({
    ...chip,
    value: valueOf(chip.field),
  }))
)

/** 緊急のみ左端に赤いアクセントを出す（frontend.md §6）。ラベルはチップが担う */
const isHigh = computed(() => props.room.urgency === URGENCY.HIGH)

const isLow = computed(() => props.room.urgency === URGENCY.LOW)
// #endregion
</script>

<template>
  <RouterLink
    class="card"
    :class="{ 'card--high': isHigh, 'card--low': isLow }"
    :to="`/inbox/${room.id}`"
  >
    <div class="card__head">
      <UserAvatar
        :display-name="room.student?.displayName ?? ''"
        :color="room.student?.avatarColor ?? ''"
        size="md"
      />
      <span class="card__name">
        <span
          v-if="room.isPinned"
          class="card__pin"
          aria-label="ピン留め"
        >📌</span>
        {{ room.student?.displayName }}
      </span>
      <!-- 件数ではなく「新着があるか」だけを点で示す -->
      <UnreadBadge
        :count="room.unreadCount ?? 0"
        :variant="UNREAD_VARIANT.DOT"
      />
    </div>

    <div class="card__chips">
      <StatusChip
        v-for="chip in chips"
        :key="chip.axis"
        :kind="chip.kind"
        :value="chip.value"
        size="sm"
      />
    </div>

    <div class="card__foot">
      <ElapsedBadge
        :since="room.lastStudentMessageAt"
        :handling-status="room.handlingStatus"
      />
    </div>
  </RouterLink>
</template>

<style scoped>
.card {
  display: block;
  padding: var(--space-md);
  border: 1px solid var(--color-hairline);
  border-left: 3px solid transparent;
  border-radius: var(--radius-lg);
  background-color: var(--color-canvas);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
}

.card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-hairline));
  box-shadow: var(--shadow-3);
  color: inherit;
}

.card--high {
  border-left-color: var(--color-sla-alert);
}

/* 緊急度 low は薄く表示（frontend.md §6）。ラベルはチップに残る */
.card--low {
  opacity: 0.62;
}

.card__head {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  min-width: 0;
}

.card__name {
  flex: 1 1 auto;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__pin {
  font-size: 10px;
}

.card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.card__foot {
  display: flex;
  justify-content: flex-end;
  min-height: 14px;
  margin-top: var(--space-sm);
}
</style>
