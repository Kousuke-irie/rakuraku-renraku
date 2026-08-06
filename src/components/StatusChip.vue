<script>
// 列挙値のラベルチップ（P1-2 / P1-3 / P1-5・constants.md）
//
// ラベルは必ず shared/constants.js の *_META から引く（日本語を直書きしない・CLAUDE.md §6-1）。
// 色を持つのは対応ステータスのみ（constants.md §1）。他の種別はニュートラル配色にする。
//
// **対応ステータスの変更（P1-2）は ProfilePanel の責務**（frontend.md §9）。
// このコンポーネントは表示のみを担う。
//
// ※ defineProps は `<script setup>` 内の変数を参照できないため、
//   props の既定値に使う定数はこの通常 `<script>` ブロック（モジュールスコープ）に置く。
import { computed } from "vue"
import {
  HANDLING_STATUS_META,
  SELECTION_STATUS_META,
  TOPIC_TAG_META,
  URGENCY_META,
} from "../constants/index.js"

/** チップが扱える列挙値の種別。利用側からも参照できるよう export する */
export const CHIP_KIND = Object.freeze({
  HANDLING: "handling",
  SELECTION: "selection",
  TOPIC: "topic",
  URGENCY: "urgency",
})

const META_BY_KIND = Object.freeze({
  [CHIP_KIND.HANDLING]: HANDLING_STATUS_META,
  [CHIP_KIND.SELECTION]: SELECTION_STATUS_META,
  [CHIP_KIND.TOPIC]: TOPIC_TAG_META,
  [CHIP_KIND.URGENCY]: URGENCY_META,
})

const KINDS = Object.values(CHIP_KIND)
const SIZES = ["sm", "md"]
const NEUTRAL_COLOR = "#8b8d98"
</script>

<script setup>
const props = defineProps({
  /** 参照する *_META の種別（CHIP_KIND のいずれか） */
  kind: {
    type: String,
    default: CHIP_KIND.HANDLING,
    validator: (value) => KINDS.includes(value),
  },
  /** 列挙値そのもの（例：HANDLING_STATUS.NEEDS_REPLY） */
  value: { type: String, default: "" },
  /** sm / md */
  size: {
    type: String,
    default: "md",
    validator: (value) => SIZES.includes(value),
  },
})

// #region computed
// 未知の値では何も描画しない（不正値をそのまま画面に出さない）
const meta = computed(() => META_BY_KIND[props.kind]?.[props.value] ?? null)

const label = computed(() => meta.value?.label ?? "")

const color = computed(() => meta.value?.color ?? NEUTRAL_COLOR)
// #endregion
</script>

<template>
  <span
    v-if="meta"
    class="status-chip"
    :class="`status-chip--${size}`"
    :style="{ '--chip-color': color }"
  >{{ label }}</span>
</template>

<style scoped>
.status-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  border: 1px solid var(--chip-color);
  border-radius: 999px;
  /* color-mix 未対応環境向けのフォールバック */
  background-color: #fff;
  background-color: color-mix(in srgb, var(--chip-color) 10%, #fff);
  color: var(--chip-color);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.status-chip--sm {
  padding: 2px 6px;
  font-size: 11px;
}

.status-chip--md {
  padding: 3px 8px;
  font-size: 12px;
}
</style>
