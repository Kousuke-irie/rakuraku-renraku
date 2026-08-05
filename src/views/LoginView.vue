<script setup>
// S-01 ログイン（A-3・frontend.md §1）
import { computed, onBeforeUnmount, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth.js"
// 白背景を透過に落としたワードマーク。円マーク内の「楽」も抜いてあるので、
// 背後のブランド面（--color-orange-soft）が透ける前提で配置する。
import logoUrl from "../images/logo-rakuraku.png"

// #region local variable
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
// #endregion

// #region reactive variable
const loginId = ref("")
const password = ref("")
const validationError = ref("")
// #endregion

// #region computed
// ログイン失敗（サーバ由来）と未入力（クライアント由来）の両方を1箇所で表示する
const errorMessage = computed(() => validationError.value || auth.error)
// #endregion

// #region local methods
/**
 * ?redirect= の戻り先。外部サイトへ飛ばされないよう自サイトの絶対パスのみ許可する。
 * @returns {string}
 */
const resolveRedirectPath = () => {
  const redirect = route.query.redirect
  if (typeof redirect !== "string") return auth.homePath
  if (!redirect.startsWith("/") || redirect.startsWith("//")) return auth.homePath
  return redirect
}
// #endregion

// #region browser event handler
const onSubmit = async () => {
  validationError.value = ""
  auth.error = null

  const id = loginId.value.trim()
  if (!id || !password.value) {
    validationError.value = "ログインIDとパスワードを入力してください"
    return
  }

  const success = await auth.login({ loginId: id, password: password.value })
  if (!success) {
    password.value = ""
    return
  }

  router.replace(resolveRedirectPath())
}
// #endregion

// #region lifecycle
// 画面を離れるときにエラーを持ち越さない
onBeforeUnmount(() => {
  auth.error = null
})
// #endregion
</script>

<template>
  <div class="login">
    <!-- 面をべた塗りにするとオレンジのワードマークが読めないため、
         ブランド色は左端の帯だけで効かせる（DESIGN.md "Keep orange scarce"） -->
    <div
      class="login__accent"
      aria-hidden="true"
    />

    <section class="login__brand">
      <img
        :src="logoUrl"
        alt="楽楽連ラク"
        class="login__logo"
        width="800"
        height="227"
      >
      <!-- 区切りは全角スペース。直に書くと no-irregular-whitespace で落ちるため文字参照にする -->
      <p class="login__tagline">
        よりよく、寄り添う&#12288;採用連絡クラウド
      </p>
    </section>

    <main class="login__pane">
      <div class="login__form-wrap">
        <h1 class="login__title">
          ログイン
        </h1>

        <form
          class="login__form"
          @submit.prevent="onSubmit"
        >
          <label
            class="field-label"
            for="login-id"
          >ログインID</label>
          <input
            id="login-id"
            v-model="loginId"
            type="text"
            autocomplete="username"
            class="field-input"
            :disabled="auth.loading"
          >

          <label
            class="field-label field-label--stacked"
            for="password"
          >パスワード</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="field-input"
            :disabled="auth.loading"
          >

          <!-- 色だけでなくテキストでも失敗を伝える（CLAUDE.md §6-13） -->
          <p
            v-if="errorMessage"
            class="error-message"
            role="alert"
          >
            エラー：{{ errorMessage }}
          </p>

          <button
            type="submit"
            class="button-primary login__submit"
            :disabled="auth.loading"
          >
            {{ auth.loading ? "ログイン中..." : "ログイン" }}
          </button>
        </form>

        <p class="login__register">
          アカウントをお持ちでない場合は
          <router-link to="/register">
            ユーザー登録
          </router-link>
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 左：ブランド面（ワードマーク＋キャッチ）／右：入力。
   画面全体を占めるので body の canvas-orange は見せない */
.login {
  display: flex;
  min-height: 100dvh;
  background-color: var(--color-canvas);
}

.login__accent {
  flex: none;
  /* 10px 以下だと実寸の画面端では帯として認識できなかったため 16px に取る */
  width: var(--space-lg);
  background-color: var(--color-primary);
}

.login__brand {
  display: flex;
  flex: 1 1 52%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* ワードマークは白抜き部分が透過しているので、面色がそのまま「楽」の中に出る */
  min-width: 0;
  padding: var(--space-huge);
  background-color: var(--color-orange-soft);
}

.login__logo {
  width: min(360px, 100%);
  height: auto;
}

.login__tagline {
  margin: var(--space-xxl) 0 0;
  color: var(--color-ink-mute);
  font-size: 15px;
}

.login__pane {
  display: flex;
  flex: 1 1 48%;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: var(--space-huge);
}

.login__form-wrap {
  width: 100%;
  max-width: 320px;
}

.login__title {
  margin: 0 0 var(--space-xxl);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.4px;
}

.login__form {
  display: flex;
  flex-direction: column;
}

.field-label {
  margin-bottom: var(--space-xs);
  font-size: 13px;
  font-weight: 700;
}

.field-label--stacked {
  margin-top: var(--space-lg);
}

.field-input {
  padding: 9px var(--space-md);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  font-size: 15px;
}

.field-input:disabled {
  background-color: var(--color-orange-soft);
  color: var(--color-ink-mute);
}

.error-message {
  margin: var(--space-lg) 0 0;
  color: var(--color-error);
  font-size: 13px;
}

.login__submit {
  margin-top: var(--space-xxl);
  width: 100%;
}

.login__register {
  margin: var(--space-xxl) 0 0;
  color: var(--color-ink-mute);
  font-size: 13px;
}
</style>
