<script setup>
// login 中の全画面に共通の外枠（S-03〜S-06）。
//
// 画面全体を固定レイヤにして、ページ自体はスクロールさせない。
// （内側の一覧・メッセージ列のスクロール量がドキュメント高さに伝播して
//   カードごと上へスクロールしてしまうのを防ぐ）
// slot に入るビューはこのセルを height:100% で埋める。
//
// ナビレールの列幅は開閉しても変えない。レールは絶対配置で右へ重なる（AppNavRail 参照）。
//
// プロフィール編集ダイアログはレールの中ではなくここに置く。開閉状態は ui ストアが持つ。
import AppNavRail from "./AppNavRail.vue"
import ProfileDialog from "./ProfileDialog.vue"
</script>

<template>
  <div class="shell">
    <div class="shell__nav">
      <AppNavRail />
    </div>

    <div class="shell__content">
      <slot />
    </div>

    <ProfileDialog />
  </div>
</template>

<style scoped>
.shell {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: var(--nav-rail-width) minmax(0, 1fr);
  /* 暗黙の行は auto だと中身より縮まないため、明示的に minmax(0,1fr) にする */
  grid-template-rows: minmax(0, 1fr);
  gap: var(--space-md);
  overflow: hidden;
  padding: var(--space-md);
}

/* レールの絶対配置の基準になる列 */
.shell__nav {
  position: relative;
  min-width: 0;
}

.shell__content {
  min-width: 0;
  min-height: 0;
}
</style>
