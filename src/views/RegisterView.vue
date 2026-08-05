<script setup>
// S-02 ユーザー登録（A-3・frontend.md §1）
import { computed, onBeforeUnmount, ref } from "vue"
import { useRouter } from "vue-router"
import { ROLE } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
// 外枠（ブランド面・入力欄の見た目）はログイン画面と共通
import AuthLayout from "../components/AuthLayout.vue"

// #region local variable
const router = useRouter()
const auth = useAuthStore()

/**
 * パスワードの最低文字数。サーバ（server/routes/auth.js）は長さを検証しないため
 * ここが唯一のガードになる。
 */
const PASSWORD_MIN_LENGTH = 8
// #endregion

// #region reactive variable
const displayName = ref("")
const loginId = ref("")
const password = ref("")
const passwordConfirm = ref("")
const validationError = ref("")
// #endregion

// #region computed
// 登録失敗（サーバ由来）と入力不備（クライアント由来）の両方を1箇所で表示する
const errorMessage = computed(() => validationError.value || auth.error)
// #endregion

// #region local methods
/**
 * 入力内容を検証する。
 * @returns {string} エラーメッセージ。問題が無ければ空文字
 */
const validate = () => {
  if (!displayName.value.trim() || !loginId.value.trim() || !password.value) {
    return "表示名・ログインID・パスワードを入力してください"
  }
  if (password.value.length < PASSWORD_MIN_LENGTH) {
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`
  }
  if (password.value !== passwordConfirm.value) {
    return "パスワードと確認用パスワードが一致しません"
  }
  return ""
}
// #endregion

// #region browser event handler
const onSubmit = async () => {
  auth.error = null
  validationError.value = validate()
  if (validationError.value) return

  // 公開登録で作れるのは学生のみ（server/routes/auth.js の SELF_REGISTRABLE_ROLES）。
  // hr / admin はシードまたは管理者機能で作るため、ロールの選択欄は置かない。
  const success = await auth.register({
    loginId: loginId.value.trim(),
    password: password.value,
    displayName: displayName.value.trim(),
    role: ROLE.STUDENT,
  })

  if (!success) {
    password.value = ""
    passwordConfirm.value = ""
    return
  }

  // 登録と同時に Cookie が発行されるので、そのままロール別のホームへ入る
  router.replace(auth.homePath)
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
  <AuthLayout title="ユーザー登録">
    <form
      class="auth-form"
      @submit.prevent="onSubmit"
    >
      <label
        class="field-label"
        for="display-name"
      >表示名</label>
      <input
        id="display-name"
        v-model="displayName"
        type="text"
        autocomplete="name"
        class="field-input"
        :disabled="auth.loading"
      >

      <label
        class="field-label field-label--stacked"
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
        autocomplete="new-password"
        class="field-input"
        :disabled="auth.loading"
      >
      <p class="field-hint">
        {{ PASSWORD_MIN_LENGTH }}文字以上
      </p>

      <label
        class="field-label field-label--stacked"
        for="password-confirm"
      >パスワード（確認）</label>
      <input
        id="password-confirm"
        v-model="passwordConfirm"
        type="password"
        autocomplete="new-password"
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
        class="button-primary auth-form__submit"
        :disabled="auth.loading"
      >
        {{ auth.loading ? "登録中..." : "登録する" }}
      </button>
    </form>

    <p class="auth-footnote">
      アカウントをお持ちの場合は
      <router-link to="/login">
        ログイン
      </router-link>
    </p>
  </AuthLayout>
</template>
