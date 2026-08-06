<script setup>
// ログイン（S-01）とユーザー登録で共通の外枠。
// 左：ブランド面（ワードマーク＋キャッチ）／右：入力カード。
// CSS を各ビューに複製すると必ずズレるため、外枠と入力欄の見た目はここに集約する。
import logoUrl from "../images/logo-rakuraku.png"
import { LOGO_MARK } from "../utils/logoMark.js"

defineProps({
  /** 右カードの見出し（例：ログイン／ユーザー登録） */
  title: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="auth-layout">
    <!-- 面をべた塗りにするとオレンジのワードマークが読めないため、
         ブランド色は左端の帯だけで効かせる（DESIGN.md "Keep orange scarce"） -->
    <div
      class="auth-layout__accent"
      aria-hidden="true"
    />

    <section class="auth-layout__brand">
      <!-- 白背景を透過に落としたワードマーク。円マーク内の「楽」も抜いてあるので、
           背後のブランド面（--color-orange-soft）が透ける。
           data-logo-mark はログイン後の円形トランジション（useCircleReveal）が
           円マークの中心を実測するための目印（utils/logoMark.js） -->
      <img
        :src="logoUrl"
        alt="楽楽連ラク"
        class="auth-layout__logo"
        :data-logo-mark="LOGO_MARK.AUTH"
        width="800"
        height="227"
      >
      <!-- 区切りは全角スペース。直に書くと no-irregular-whitespace で落ちるため文字参照にする -->
      <p class="auth-layout__tagline">
        よりよく、寄り添う&#12288;採用連絡クラウド
      </p>
    </section>

    <main class="auth-layout__pane">
      <div class="auth-layout__card">
        <h1 class="auth-layout__title">
          {{ title }}
        </h1>
        <slot />
      </div>
    </main>
  </div>
</template>

<!-- scoped にせず .auth-layout で前置修飾している。slot に渡されるフォームの
     見た目（field-label / field-input 等）もここで一元管理したいため。
     接頭辞があるので認証画面の外には影響しない。 -->
<style>
/* 画面全体を占めるので body の canvas-orange は見せない */
.auth-layout {
  display: flex;
  min-height: 100dvh;
  background-color: var(--color-canvas);
}

.auth-layout__accent {
  flex: none;
  /* 10px 以下だと実寸の画面端では帯として認識できなかったため 16px に取る */
  width: var(--space-lg);
  background-color: var(--color-primary);
}

.auth-layout__brand {
  display: flex;
  flex: 1 1 52%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: var(--space-huge);
  background-color: var(--color-orange-soft);
}

.auth-layout__logo {
  width: min(360px, 100%);
  height: auto;
}

.auth-layout__tagline {
  margin: var(--space-xxl) 0 0;
  color: var(--color-ink-mute);
  font-size: 15px;
}

.auth-layout__pane {
  display: flex;
  flex: 1 1 48%;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: var(--space-huge);
}

.auth-layout__card {
  width: 100%;
  max-width: 320px;
}

.auth-layout__title {
  margin: 0 0 var(--space-xxl);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.4px;
}

/* --- 以下は slot に渡されるフォーム側のクラス --- */

.auth-layout .auth-form {
  display: flex;
  flex-direction: column;
}

.auth-layout .field-label {
  margin-bottom: var(--space-xs);
  font-size: 13px;
  font-weight: 700;
}

/* 2つ目以降の項目。1つ目は見出しとの間隔があるので付けない */
.auth-layout .field-label--stacked {
  margin-top: var(--space-lg);
}

.auth-layout .field-input {
  padding: 9px var(--space-md);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  font-size: 15px;
}

.auth-layout .field-input:disabled {
  background-color: var(--color-orange-soft);
  color: var(--color-ink-mute);
}

.auth-layout .field-hint {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.auth-layout .error-message {
  margin: var(--space-lg) 0 0;
  color: var(--color-error);
  font-size: 13px;
}

.auth-layout .auth-form__submit {
  margin-top: var(--space-xxl);
  width: 100%;
}

.auth-layout .auth-footnote {
  margin: var(--space-xxl) 0 0;
  color: var(--color-ink-mute);
  font-size: 13px;
}
</style>
