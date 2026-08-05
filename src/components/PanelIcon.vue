<script setup>
// ペインの最小化・復帰ボタン用のアイコン（B-2）
//
// 「枠＋片側の細い列＋シェブロン」で、どちら側のペインをどちら向きに動かすかを示す。
// アイコンライブラリを追加せずに済むよう、インライン SVG で描く。
// ボタン側に aria-label を付ける前提なので、この SVG は支援技術から隠す。
import { computed } from "vue"

// #region constants
const SIDE = Object.freeze({ LEFT: "left", RIGHT: "right" })
/** 細い列の位置（viewBox 24 系の座標） */
const DIVIDER_X = Object.freeze({ [SIDE.LEFT]: 9, [SIDE.RIGHT]: 15 })
/** シェブロンを置く広い側の中心 */
const CHEVRON_CX = Object.freeze({ [SIDE.LEFT]: 15.5, [SIDE.RIGHT]: 8.5 })
// #endregion

// defineProps の既定値はコンパイル時に巻き上げられるためローカル変数を参照できない。
// ここだけ SIDE を使わずリテラルで書く。
const props = defineProps({
  /** 細い列がどちら側にあるか（＝どちらのペインを表すか）。"left" | "right" */
  side: { type: String, default: "left" },
  /** シェブロンの向き。畳む向き／開く向きを示す。"left" | "right" */
  direction: { type: String, default: "left" },
})

// #region computed
const dividerX = computed(() => DIVIDER_X[props.side] ?? DIVIDER_X[SIDE.LEFT])

const chevron = computed(() => {
  const cx = CHEVRON_CX[props.side] ?? CHEVRON_CX[SIDE.LEFT]
  return props.direction === SIDE.RIGHT
    ? `M${cx - 1.5} 9.25 L${cx + 1.5} 12 L${cx - 1.5} 14.75`
    : `M${cx + 1.5} 9.25 L${cx - 1.5} 12 L${cx + 1.5} 14.75`
})
// #endregion
</script>

<template>
  <svg
    class="panel-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      x="3.5"
      y="4.5"
      width="17"
      height="15"
      rx="3"
    />
    <line
      :x1="dividerX"
      y1="4.5"
      :x2="dividerX"
      y2="19.5"
    />
    <path
      :d="chevron"
      stroke-width="2"
    />
  </svg>
</template>

<style scoped>
.panel-icon {
  width: 17px;
  height: 17px;
}
</style>
