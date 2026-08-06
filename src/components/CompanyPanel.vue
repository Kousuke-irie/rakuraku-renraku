<script setup>
// 学生用トークの右に常設する会社情報パネル（P2-10・frontend.md §7-2）
//
// 中身は人事が設定画面（CompanySettingsPanel）で入れた値をそのまま出すだけ。
// 学生は編集できない。データは ui ストアが持つ（ルームに紐づかないマスタデータ）。
//
// ★本文は必ずテキスト補間で描画する。v-html は使わない（frontend.md §10-1）。
//   人事の入力とはいえ、学生の画面に HTML を流し込む経路を作らない。
import { computed } from "vue"
import { useUiStore } from "../stores/ui.js"

// #region global state
const ui = useUiStore()
// #endregion

// #region computed
const company = computed(() => ui.company)

/**
 * 紹介文の段落。改行はそのまま白紙の行にせず、段落に分けて行間を持たせる。
 * CSS の white-space: pre-wrap だけだと長文で読みづらいため。
 */
const paragraphs = computed(() =>
  (company.value?.description ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
)
// #endregion
</script>

<template>
  <aside
    class="company"
    aria-labelledby="company-heading"
  >
    <header class="company__head">
      <h2
        id="company-heading"
        class="company__heading"
      >
        会社情報
      </h2>
    </header>

    <div class="company__body">
      <!-- 人事がまだ設定していない場合。学生に不足を感じさせない中立な文言にする -->
      <p
        v-if="!company"
        class="company__empty"
      >
        会社情報はまだ公開されていません。
      </p>

      <template v-else>
        <p class="company__name">
          {{ company.name }}
        </p>

        <p
          v-for="(paragraph, index) in paragraphs"
          :key="index"
          class="company__text"
        >
          {{ paragraph }}
        </p>

        <!-- 外部サイトへ出るリンク。タブ乗っ取り（window.opener）を防ぐため
             target="_blank" には必ず rel="noopener noreferrer" を付ける -->
        <a
          v-if="company.recruitSiteUrl"
          class="company__link"
          :href="company.recruitSiteUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          採用サイトを見る
          <span aria-hidden="true">→</span>
          <span class="sr-only">（新しいタブで開きます）</span>
        </a>
      </template>
    </div>
  </aside>
</template>

<style scoped>
/* トークカード（ChatView の .chat__card）と同じ「白カード」の作りに揃える */
.company {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.company__head {
  flex: none;
  padding: var(--space-md) var(--space-xl);
  border-bottom: 1px solid var(--color-hairline);
}

.company__heading {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-ink-mute);
  letter-spacing: 0.04em;
}

/* 情報が増えてもトークの高さを押し広げないよう、パネルの中でスクロールさせる */
.company__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-xl);
}

.company__name {
  margin: 0 0 var(--space-md);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
}

.company__text {
  margin: 0 0 var(--space-md);
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.8;
}

.company__empty {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.8;
}

/* 面接前の学生が押す唯一の導線なので、リンクではなくボタンの体裁で置く。
   オレンジは CTA とアクティブ状態のみ（DESIGN.md） */
.company__link {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
  justify-content: center;
  margin-top: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.company__link:hover,
.company__link:focus-visible {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

@media (prefers-reduced-motion: reduce) {
  .company__link {
    transition: none;
  }
}
</style>
