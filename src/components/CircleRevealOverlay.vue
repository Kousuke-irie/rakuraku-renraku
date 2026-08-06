<script setup>
// ログイン → ホームの画面転換で使う、画面を覆うオレンジの円（描画だけを担当する）。
//
// 進行の指揮は composables/useCircleReveal.js が行い、このコンポーネントは
// ui ストアの circleReveal をそのまま transform に流すだけにしてある。
// ルート切替をまたいで生き残る必要があるため、AppShell の外（App.vue）に置く。
//
// ★大きさは transform: scale() だけで変える（width/height を触ると毎フレーム
//   レイアウトが走る）。基準の直径は固定値にして、そこから拡大・縮小する。
import { computed } from "vue"
import { CIRCLE_REVEAL_PHASE, useUiStore } from "../stores/ui.js"
import { CIRCLE_REVEAL_BASE_DIAMETER } from "../composables/useCircleReveal.js"

// #region global state
const ui = useUiStore()
// #endregion

// #region computed
const reveal = computed(() => ui.circleReveal)

const visible = computed(() => reveal.value.phase !== CIRCLE_REVEAL_PHASE.IDLE)

/**
 * 中心を (x, y) に置いたうえで自身の中心を軸に拡大する。
 * translate の % は自分の幅・高さに対する割合なので、-50% でちょうど中心が座標に載る。
 * scale が先に適用されるため、translate 量は倍率の影響を受けない。
 */
const style = computed(() => ({
  width: `${CIRCLE_REVEAL_BASE_DIAMETER}px`,
  height: `${CIRCLE_REVEAL_BASE_DIAMETER}px`,
  opacity: String(reveal.value.opacity),
  transform: `translate(calc(${reveal.value.x}px - 50%), calc(${reveal.value.y}px - 50%)) scale(${reveal.value.scale})`,
  // 中心の差し替え中だけ transition を切る。効かせたままだと円が横滑りして見える
  transition: reveal.value.eased
    ? `transform ${reveal.value.durationMs}ms ${reveal.value.easing}, opacity ${reveal.value.durationMs}ms ${reveal.value.easing}`
    : "none",
}))
// #endregion
</script>

<template>
  <!-- 装飾なので支援技術からは隠す。data 属性は useCircleReveal が transitionend を
       待つために掴む目印 -->
  <div
    v-if="visible"
    class="circle-reveal"
    data-circle-reveal
    aria-hidden="true"
    :style="style"
  />
</template>

<style scoped>
.circle-reveal {
  position: fixed;
  /* トースト（100）より上。画面転換中は何よりも手前に出す */
  z-index: 1000;
  top: 0;
  left: 0;
  border-radius: 50%;
  background-color: var(--color-primary);
  /* 覆っている間もクリックの当たり判定を持たせない（ヒットテストの対象外にする） */
  pointer-events: none;
  will-change: transform;
}
</style>
