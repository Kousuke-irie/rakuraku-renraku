import { createRouter, createWebHistory } from "vue-router"
import { ROLE } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import LoginView from "../views/LoginView.vue"
import RegisterView from "../views/RegisterView.vue"
import HomeView from "../views/HomeView.vue"
import InboxView from "../views/InboxView.vue"
import ChatView from "../views/ChatView.vue"
import NotificationsView from "../views/NotificationsView.vue"
import ProfileSettingsView from "../views/ProfileSettingsView.vue"

/**
 * 画面一覧は frontend.md §1（S-01〜S-06）に対応する。
 *
 * meta.requiresAuth … 未認証なら /login へ退避する
 * meta.roles        … 入室できるロール。未指定は認証済みの全ロール
 */
const routes = [
  {
    // 認証状態に応じた振り分けは beforeEach に任せる。
    // hr/admin はそのまま /home、student は roles 不一致で /chat へ送られる。
    path: "/",
    redirect: "/home",
  },
  {
    path: "/login",
    name: "login",
    component: LoginView,
  },
  {
    path: "/register",
    name: "register",
    component: RegisterView,
  },
  {
    // S-07 ホーム。人事のログイン後の着地点（frontend.md §1・§5-2）。
    // 返信はここでは行わず、行クリックで /inbox/:roomId へ渡す。
    path: "/home",
    name: "home",
    component: HomeView,
    meta: { requiresAuth: true, roles: [ROLE.HR, ROLE.ADMIN] },
  },
  {
    path: "/inbox",
    name: "inbox",
    component: InboxView,
    meta: { requiresAuth: true, roles: [ROLE.HR, ROLE.ADMIN] },
  },
  {
    // 受信箱は2ペインを維持したまま URL だけ変わる（frontend.md §1）ため、
    // /inbox と同じコンポーネントを使う。
    path: "/inbox/:roomId",
    name: "inbox-room",
    component: InboxView,
    props: true,
    meta: { requiresAuth: true, roles: [ROLE.HR, ROLE.ADMIN] },
  },
  {
    path: "/chat",
    name: "chat",
    component: ChatView,
    meta: { requiresAuth: true, roles: [ROLE.STUDENT] },
  },
  {
    // 通知一覧（ナビレールのベルから開く）。受信箱に対する機能なので人事のみ。
    // ★雛形。要件IDが無い画面なので frontend.md §1 の S-xx は割り当てていない
    path: "/notifications",
    name: "notifications",
    component: NotificationsView,
    meta: { requiresAuth: true, roles: [ROLE.HR, ROLE.ADMIN] },
  },
  {
    path: "/settings/profile",
    name: "profile-settings",
    component: ProfileSettingsView,
    meta: { requiresAuth: true },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/home",
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * 認証状態ベースのガード（A-3・frontend.md §2）。
 *
 * 「login 画面から遷移してきたか」で判定するとリロードで必ず弾かれるため、
 * 常に /api/auth/me の解決結果だけを見る。
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // リロード直後は user が空なので、Cookie からのセッション復元を待つ
  if (!auth.initialized) await auth.fetchMe()

  // 未認証で保護ページ → ログインへ（戻り先を query に保持）
  if (to.meta.requiresAuth && !auth.user) {
    return { name: "login", query: { redirect: to.fullPath } }
  }

  // 認証済みでログイン／登録画面 → ロールに応じたホームへ
  if ((to.name === "login" || to.name === "register") && auth.user) {
    return auth.homePath
  }

  // ロール不一致 → 自分のホームへ（例：student が /inbox を開いた）
  if (auth.user && to.meta.roles && !to.meta.roles.includes(auth.user.role)) {
    return to.path === auth.homePath ? false : auth.homePath
  }

  return true
})

export default router
