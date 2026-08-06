<script setup>
// ナビレール（AppNavRail）用のアイコン。
//
// アイコンライブラリは追加しない方針（CLAUDE.md §3）なので、PanelIcon と同じく
// インライン SVG で描く。viewBox 24 系の stroke パスだけで構成し、塗りは使わない。
// リンク／ボタン側に aria-label を付ける前提なので、この SVG は支援技術から隠す。
import { computed } from "vue"

// #region constants
/**
 * アイコン名 → stroke パスの配列。
 * 丸いつまみ（settings）も circle 要素を混ぜずに済むよう円弧パスで描く。
 */
const PATHS = Object.freeze({
  // 家（S-07 ホーム）
  home: [
    "M4 10.5 L12 4 l8 6.5",
    "M5.75 9.5 V18.5 a1.5 1.5 0 0 0 1.5 1.5 h9.5 a1.5 1.5 0 0 0 1.5-1.5 V9.5",
    "M9.75 20 v-5.5 h4.5 V20",
  ],
  // 受信箱（対応の主画面）
  inbox: [
    "M3.5 13.5 L6 5.5 h12 l2.5 8",
    "M3.5 13.5 h4.5 l1.5 2.5 h5 l1.5-2.5 h4.5 v4 a2 2 0 0 1-2 2 H5.5 a2 2 0 0 1-2-2 z",
  ],
  // 2人の人型（S-08 全学生）。受信箱（1件ずつ）に対して「人の集まり」を表す
  students: [
    "M12.25 8 a3.25 3.25 0 1 1-6.5 0 a3.25 3.25 0 0 1 6.5 0",
    "M3.5 19.5 v-0.75 A4.25 4.25 0 0 1 7.75 14.5 h2.5 A4.25 4.25 0 0 1 14.5 18.75 v0.75",
    "M15.5 5.4 a3 3 0 0 1 0 5.2",
    "M16.75 14.6 A4.25 4.25 0 0 1 20.5 18.75 v0.75",
  ],
  // 吹き出し（学生のホーム）
  chat: [
    "M4 7 A2.5 2.5 0 0 1 6.5 4.5 h11 A2.5 2.5 0 0 1 20 7 v6 a2.5 2.5 0 0 1-2.5 2.5 H10 L6 19.5 V15.5 A2.5 2.5 0 0 1 4 13 z",
  ],
  // ベル（アラート）
  bell: [
    "M12 3.5 A5.5 5.5 0 0 0 6.5 9 c0 3.8-1.5 5.5-1.5 5.5 h14 s-1.5-1.7-1.5-5.5 A5.5 5.5 0 0 0 12 3.5 z",
    "M9.9 17.5 a2.2 2.2 0 0 0 4.2 0",
  ],
  // スライダー（設定）。歯車より線が少なく小さい寸法でも潰れない
  settings: [
    "M4 7.5 h9.5",
    "M13.5 7.5 a2 2 0 1 0 4 0 a2 2 0 1 0-4 0",
    "M17.5 7.5 h2.5",
    "M4 16.5 h4.5",
    "M8.5 16.5 a2 2 0 1 0 4 0 a2 2 0 1 0-4 0",
    "M12.5 16.5 h7.5",
  ],
  // 棒グラフ（P4-4 監視ダッシュボード）。3本の縦棒＋ベースラインで、
  // 他のアイコンと同じ線幅・同じ 24 グリッドに収める
  chart: [
    "M4 19.5 h16",
    "M7.5 19.5 v-5",
    "M12 19.5 v-9",
    "M16.5 19.5 v-6.5",
  ],
  // ドア＋外向き矢印（ログアウト）
  logout: [
    "M13.5 4.5 H6.5 a2 2 0 0 0-2 2 v11 a2 2 0 0 0 2 2 h7",
    "M13 12 h7.5",
    "M17.5 8.5 L21 12 l-3.5 3.5",
  ],
})
// #endregion

// defineProps の既定値・validator はコンパイル時に巻き上げられるため、
// setup スコープの PATHS を参照できない。ここだけ名前をリテラルで書く。
const props = defineProps({
  /** "home" | "inbox" | "students" | "chat" | "bell" | "chart" | "settings" | "logout" */
  name: {
    type: String,
    required: true,
    validator: (value) =>
      ["home", "inbox", "students", "chat", "bell", "chart", "settings", "logout"].includes(value),
  },
})

// #region computed
const paths = computed(() => PATHS[props.name] ?? [])
// #endregion
</script>

<template>
  <svg
    class="nav-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-for="(d, index) in paths"
      :key="index"
      :d="d"
    />
  </svg>
</template>

<style scoped>
.nav-icon {
  flex: none;
  width: 20px;
  height: 20px;
}
</style>
