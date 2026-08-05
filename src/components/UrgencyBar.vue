<script setup>
// 緊急度の視覚表現（P1-6・frontend.md §6 / constants.md §4）
//
// high = 行の左端に赤いバー、low = 行全体を薄く表示。
// **行全体の淡色化（low）は親＝RoomListItem の責務。** ここはバーとラベルのみを描画する。
// バーは行の高さに合わせたいので、親は flex コンテナ（align-items: stretch）に置くこと。
//
// 色だけで情報を伝えないため、high / low ではテキストラベルを併記する（CLAUDE.md §6-13）。
import { computed } from "vue"
import { URGENCY, URGENCY_META } from "../constants/index.js"

const props = defineProps({
  /** URGENCY のいずれか */
  urgency: { type: String, default: URGENCY.NORMAL },
  /** ラベルを可視表示するか。false でも読み上げ用に sr-only で残す */
  showLabel: { type: Boolean, default: true },
})

// #region computed
const label = computed(() => URGENCY_META[props.urgency]?.label ?? "")

// normal は視覚的なノイズになるだけなので出さない（読み上げには残す）
const labelVisible = computed(() => props.showLabel && props.urgency !== URGENCY.NORMAL)
// #endregion
</script>

<template>
  <span
    class="urgency"
    :class="`urgency--${urgency}`"
  >
    <!-- normal でも幅を確保し、行のレイアウトが揺れないようにする -->
    <span
      class="urgency__bar"
      aria-hidden="true"
    />
    <span :class="labelVisible ? 'urgency__label' : 'sr-only'">{{ label }}</span>
  </span>
</template>

<style scoped>
.urgency {
  display: inline-flex;
  align-items: stretch;
  gap: 4px;
}

.urgency__bar {
  flex: none;
  width: 4px;
  min-height: 14px;
  border-radius: 2px;
  background-color: transparent;
}

.urgency--high .urgency__bar {
  background-color: #e5484d;
}

.urgency--low .urgency__bar {
  background-color: #8b8d98;
}

.urgency__label {
  align-self: center;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.urgency--high .urgency__label {
  color: #e5484d;
}

.urgency--low .urgency__label {
  color: #8b8d98;
}
</style>
