<script setup>
// 状態は Pinia に集約する。provide/inject のバケツリレーは使わない（frontend.md §10-2）
import { computed } from "vue"
import { useRoute } from "vue-router"
import { useAuthStore } from "./stores/auth.js"
import AppShell from "./components/AppShell.vue"

// #region global state
const auth = useAuthStore()
// #endregion

// #region local variable
const route = useRoute()
// #endregion

// #region computed
/**
 * 共通シェル（ナビレール）で包むかどうか。
 * 認証が必要な画面（S-03〜S-06）だけ包む。ログイン・登録（S-01/S-02）は
 * AuthLayout が全画面を占めるためレールを出さない。
 */
const withShell = computed(() => Boolean(route.meta.requiresAuth) && auth.isAuthenticated)
// #endregion
</script>

<template>
  <AppShell v-if="withShell">
    <RouterView />
  </AppShell>
  <RouterView v-else />
</template>
