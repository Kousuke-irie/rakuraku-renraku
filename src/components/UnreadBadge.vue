<script>
// 未読の表示（P1-1・frontend.md §6）
//
// 2つの見せ方を持つ：
//   count … 行の右端に青丸バッジ＋件数（受信箱の一覧）
//   dot   … 件数を出さず「新着があるか」だけを点で示す（ホームのカード・frontend.md §5-2）
//
// ※ defineProps は `<script setup>` 内の変数を参照できないため、
//   props の validator に使う定数はこの通常 `<script>` ブロックに置く。
import { computed } from "vue"

/** バッジの見せ方。利用側からも参照できるよう export する */
export const UNREAD_VARIANT = Object.freeze({
  COUNT: "count",
  DOT: "dot",
})

const VARIANTS = Object.values(UNREAD_VARIANT)
</script>

<script setup>
const props = defineProps({
  /** 未読件数。0 なら何も描画しない */
  count: { type: Number, default: 0 },
  /** これを超えたら "99+" 表記にする（count 表示のときのみ） */
  max: { type: Number, default: 99 },
  /** count / dot */
  variant: {
    type: String,
    default: UNREAD_VARIANT.COUNT,
    validator: (value) => VARIANTS.includes(value),
  },
})

// #region computed
const visible = computed(() => props.count > 0)

const isDot = computed(() => props.variant === UNREAD_VARIANT.DOT)

const text = computed(() => (props.count > props.max ? `${props.max}+` : String(props.count)))

// 点だけでは何件あるか分からないので、読み上げには必ず件数を残す（CLAUDE.md §6-13）
const label = computed(() => (isDot.value ? "新着メッセージあり" : `未読${props.count}件`))
// #endregion
</script>

<template>
  <span
    v-if="visible"
    class="unread-badge"
    :class="{ 'unread-badge--dot': isDot }"
    :aria-label="label"
  >
    <template v-if="!isDot">{{ text }}</template>
    <span
      v-else
      class="sr-only"
    >{{ label }}</span>
  </span>
</template>

<style scoped>
.unread-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: #2563eb;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

/* 件数を出さず、新着の有無だけを点で示す */
.unread-badge--dot {
  min-width: 8px;
  width: 8px;
  height: 8px;
  padding: 0;
  border-radius: var(--radius-pill);
}
</style>
