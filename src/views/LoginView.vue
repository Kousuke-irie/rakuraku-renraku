<script setup>
// S-01 ログイン（A-3・frontend.md §1）
import { computed, onBeforeUnmount, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth.js"

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
  <div class="login-page">
    <h1 class="text-h4 font-weight-medium">
      ログイン
    </h1>
    <p class="text-body-2 mt-2">
      採用コミュニケーション管理ツール
    </p>

    <form
      class="login-form mt-8"
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
        class="field-label mt-4"
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
        class="error-message mt-4"
        role="alert"
      >
        エラー：{{ errorMessage }}
      </p>

      <button
        type="submit"
        class="button-normal mt-6"
        :disabled="auth.loading"
      >
        {{ auth.loading ? "ログイン中..." : "ログイン" }}
      </button>
    </form>

    <p class="mt-6 text-body-2">
      アカウントをお持ちでない場合は
      <router-link to="/register">
        ユーザー登録
      </router-link>
    </p>
  </div>
</template>

<style scoped>
.login-page {
  max-width: 360px;
  margin: 0 auto;
  padding-top: 48px;
}

.login-form {
  display: flex;
  flex-direction: column;
}

.field-label {
  font-size: 14px;
  margin-bottom: 4px;
}

.field-input {
  border: 1px solid #888;
  border-radius: 4px;
  padding: 6px 8px;
}

.field-input:disabled {
  background-color: #f5f5f5;
}

.error-message {
  color: #e5484d;
  font-size: 14px;
}
</style>
