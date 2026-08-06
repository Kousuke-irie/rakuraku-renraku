<script setup>
// 未対応サマリー（P1-8・frontend.md §5-2）
//
// 「要返信 5件・緊急 3件・24h超 2件」を常時表示し、**各項目クリックでフィルタを適用**する。
// ホーム（S-07）と受信箱（S-03/S-04）の両方で使う。行の見た目と同様、
// サマリーの見た目とふるまいはこのコンポーネントが単独で持つ。
//
// ★件数の情報源について
//   絞り込み前の**全件**を数える。絞り込むたびに未対応件数が減って見えると、
//   「あと何件対応が残っているか」という本来の役割が壊れるため。
//   本来は GET /api/summary（roomsStore.summary）だが fetchSummary が空実装なので、
//   ルーム一覧からの集計で出している。socket の message:new / room:updated で
//   rooms が更新されるため、リロードせず件数が増える（P1-8 の受入条件）。
//
// ★トグルの単位
//   1項目＝1つの絞り込み条件。押すたびにその条件だけを入り切りするので、
//   「要返信」と「緊急」を両方押せば AND で絞り込める（P1-7 の受入条件）。
import { computed } from "vue"
import {
  ELAPSED_BADGE_HIDDEN_STATUSES,
  HANDLING_STATUS,
  HANDLING_STATUS_META,
  SLA_ALERT_HOURS,
  URGENCY,
  URGENCY_META,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"

// #region constants
/** チップの配色。緊急・24h超＝SLA の赤／要返信＝ブランドのオレンジ */
const TONE = Object.freeze({
  ALERT: "alert",
  WARN: "warn",
})
// #endregion

// #region global state
const rooms = useRoomsStore()
// #endregion

// #region local methods
/** SLA 超過の対象か（返信済み・完了は対象外・constants.md §9） */
const isOverdue = (room) =>
  !ELAPSED_BADGE_HIDDEN_STATUSES.includes(room.handlingStatus) &&
  (room.elapsedHours ?? 0) >= SLA_ALERT_HOURS

/** その1件だけで絞り込まれている状態か（配列フィルタ用） */
const isOnly = (values, value) => values.length === 1 && values[0] === value
// #endregion

// #region computed
/**
 * 各項目は「ラベル・件数・現在その条件で絞っているか・押したときの絞り込み条件」を持つ。
 * 条件を1つ増やすときはここに1行足す。
 */
const items = computed(() => {
  const { handlingStatus, urgency, overdueOnly } = rooms.filters

  return [
    {
      key: "urgent",
      label: URGENCY_META[URGENCY.HIGH].label,
      count: rooms.rooms.filter((room) => room.urgency === URGENCY.HIGH).length,
      tone: TONE.ALERT,
      active: isOnly(urgency, URGENCY.HIGH),
      patchOf: (active) => ({ urgency: active ? [] : [URGENCY.HIGH] }),
    },
    {
      key: "needsReply",
      label: HANDLING_STATUS_META[HANDLING_STATUS.NEEDS_REPLY].label,
      count: rooms.rooms.filter((room) => room.handlingStatus === HANDLING_STATUS.NEEDS_REPLY)
        .length,
      tone: TONE.WARN,
      active: isOnly(handlingStatus, HANDLING_STATUS.NEEDS_REPLY),
      patchOf: (active) => ({
        handlingStatus: active ? [] : [HANDLING_STATUS.NEEDS_REPLY],
      }),
    },
    {
      key: "overdue24h",
      label: `${SLA_ALERT_HOURS}h超`,
      count: rooms.rooms.filter(isOverdue).length,
      tone: TONE.ALERT,
      active: overdueOnly,
      patchOf: (active) => ({ overdueOnly: !active }),
    },
  ]
})
// #endregion

// #region browser event handler
/** 押すたびにその条件だけを入り切りする（他の絞り込みは残す） */
const onToggle = (item) => rooms.applyFilters(item.patchOf(item.active))
// #endregion
</script>

<template>
  <ul
    class="summary"
    aria-label="未対応サマリー"
  >
    <li
      v-for="item in items"
      :key="item.key"
    >
      <!-- 押している状態は色だけでなく aria-pressed と「解除」の説明でも伝える -->
      <button
        type="button"
        class="summary__item"
        :class="[
          `summary__item--${item.tone}`,
          {
            'summary__item--empty': item.count === 0 && !item.active,
            'summary__item--active': item.active,
          },
        ]"
        :aria-pressed="item.active"
        :title="item.active ? `${item.label}の絞り込みを解除する` : `${item.label}で絞り込む`"
        @click="onToggle(item)"
      >
        <span class="summary__label">{{ item.label }}</span>
        <span class="summary__count">{{ item.count }}</span>
        <span class="summary__unit">件</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.summary {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}

.summary__item {
  /* 色はトーンごとに差し替える。以降のルールはこの2つだけを参照する */
  --tone: var(--color-ink-mute);
  --tone-on: var(--color-on-primary);

  display: inline-flex;
  gap: 6px;
  align-items: baseline;
  padding: 5px 12px;
  border: 1px solid color-mix(in srgb, var(--tone) 35%, transparent);
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--tone) 9%, var(--color-canvas));
  color: var(--tone);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
}

.summary__item:hover {
  border-color: var(--tone);
  background-color: color-mix(in srgb, var(--tone) 18%, var(--color-canvas));
}

.summary__item:active {
  transform: translateY(1px);
}

.summary__item:focus-visible {
  outline: 2px solid var(--tone);
  outline-offset: 2px;
}

/* 絞り込み中は塗りに反転させ、押されていることを一目で分かるようにする */
.summary__item--active {
  border-color: var(--tone);
  background-color: var(--tone);
  color: var(--tone-on);
  box-shadow: var(--shadow-3);
}

.summary__item--active:hover {
  background-color: color-mix(in srgb, var(--tone) 85%, #000);
}

.summary__item--alert {
  --tone: var(--color-sla-alert);
}

.summary__item--warn {
  --tone: var(--color-primary);
}

/* 0件は主張させない。赤や橙のまま残ると「対応が必要」に見えてしまう */
.summary__item--empty {
  --tone: var(--color-ink-mute);

  border-color: var(--color-hairline);
  background-color: var(--color-canvas);
}

.summary__count {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.summary__unit {
  font-size: 11px;
  font-weight: 400;
}
</style>
