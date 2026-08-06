<script setup>
// 通知一覧（ナビレールのベルから開く画面）
//
// ★このビューは**雛形**である。件数だけ実データ（受信箱の要返信）で出しており、
//   通知そのものの一覧・既読管理・種別は未実装。
//   通知を独立した機能として作るなら要件IDの追加が必要（CLAUDE.md §6-3）。
//   要件IDを増やさない方針なら、ここは要返信ルームの一覧に寄せるのが素直。
import { computed, onMounted } from "vue"
import { HANDLING_STATUS, HANDLING_STATUS_META, URGENCY } from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"

// #region global state
const rooms = useRoomsStore()
// #endregion

// #region computed
/**
 * 通知の見出しに出す件数。
 * ★P1-8 で GET /api/summary が入ったら rooms.summary に差し替える。
 *   それまでは AppNavRail / InboxSidebar と同じ暫定集計で出す。
 *   受信箱は担当制なので、数えるのは自分の担当ルームだけ（#28・roomsStore.myRooms）。
 */
const counts = computed(() => ({
  needsReply: rooms.myRooms.filter(
    (room) => room.handlingStatus === HANDLING_STATUS.NEEDS_REPLY
  ).length,
  urgent: rooms.myRooms.filter((room) => room.urgency === URGENCY.HIGH).length,
}))

const needsReplyLabel = computed(
  () => HANDLING_STATUS_META[HANDLING_STATUS.NEEDS_REPLY].label
)
// #endregion

// #region lifecycle
onMounted(async () => {
  if (rooms.rooms.length === 0) await rooms.fetchRooms()
})
// #endregion
</script>

<template>
  <div class="notifications">
    <div class="card">
      <header class="card__head">
        <h1 class="card__title">
          通知
        </h1>
        <p class="card__note">
          {{ needsReplyLabel }} {{ counts.needsReply }}件 ／ 緊急 {{ counts.urgent }}件
        </p>
      </header>

      <p class="card__placeholder">
        通知一覧はまだ実装されていません。<br>
        受信箱の対応状況は
        <RouterLink to="/inbox">
          受信箱
        </RouterLink>
        で確認できます。
      </p>
    </div>
  </div>
</template>

<style scoped>
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めて中央寄せするだけ */
.notifications {
  height: 100%;
  max-width: 720px;
  margin: 0 auto;
  overflow: hidden;
  padding: var(--space-xs) 0 var(--space-sm);
}

/* 受信箱・トークのペインと同じ「白カード」の作りに揃える */
.card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.card__head {
  flex: none;
  padding: var(--space-lg) var(--space-xxl);
  border-bottom: 1px solid var(--color-hairline);
}

.card__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02px;
}

.card__note {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.card__placeholder {
  padding: var(--space-huge) var(--space-xxl);
  color: var(--color-ink-mute);
  font-size: 13px;
  line-height: 1.9;
  text-align: center;
}
</style>
