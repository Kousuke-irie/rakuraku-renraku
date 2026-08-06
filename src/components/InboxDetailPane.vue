<script setup>
// 受信箱の右ペイン（frontend.md §5 のレイアウト枠）
//
// ★プロフィールの編集（P2-4/P2-9）は ProfilePanel、申し送りメモ（P2-5/P2-6）は MemoPanel に委譲済み。
//   日程調整の進捗更新（P3-4）は**未実装**で、現在の値の表示だけを行う。
import { computed } from "vue"
import {
  DEFAULT_SCHEDULE_STATE,
  SCHEDULE_STATE_META,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"
import MemoPanel from "./MemoPanel.vue"
import PanelIcon from "./PanelIcon.vue"
import ProfilePanel from "./ProfilePanel.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UserAvatar from "./UserAvatar.vue"

// #region constants
const UNSET_LABEL = "未設定"
// #endregion

const props = defineProps({
  /** rooms ストアの room。null なら空状態を出す */
  room: { type: Object, default: null },
})

// #region global state
const ui = useUiStore()
// #endregion

// #region computed
const student = computed(() => props.room?.student ?? {})

const scheduleStateLabel = computed(
  () =>
    SCHEDULE_STATE_META[student.value.scheduleState ?? DEFAULT_SCHEDULE_STATE]?.label ?? UNSET_LABEL
)

// #endregion
</script>

<template>
  <aside class="detail">
    <div class="detail__head">
      <h2 class="detail__title">
        詳細
      </h2>
      <!-- 最小化。復帰用のボタンは畳んだ跡に残る細いカードに出る -->
      <button
        type="button"
        class="icon-button"
        title="詳細を最小化する"
        aria-label="詳細を最小化する"
        @click="ui.toggleProfilePanel()"
      >
        <PanelIcon
          side="right"
          direction="right"
        />
      </button>
    </div>

    <p
      v-if="!room"
      class="detail__empty"
    >
      学生を選ぶと、ここに状況がまとまって表示されます。
    </p>

    <div
      v-else
      class="detail__body"
    >
      <div class="detail__student">
        <UserAvatar
          :display-name="student.displayName ?? ''"
          :color="student.avatarColor ?? ''"
          size="lg"
        />
        <p class="detail__name">
          {{ student.displayName }}
        </p>
        <p class="detail__university">
          {{ student.university }}
        </p>
        <StatusChip
          :kind="CHIP_KIND.SELECTION"
          :value="student.selectionStatus"
          size="sm"
        />
      </div>

      <!-- 担当人事・選考ステータス・次回面接・会議室・面接官のインライン編集（P2-4/P2-9） -->
      <ProfilePanel :room="room" />

      <!-- 申し送りメモ（P2-5/P2-6） -->
      <div class="section">
        <MemoPanel :room-id="room.id" />
      </div>

      <!-- 日程調整トラッカー（P3-4）：現在の進捗の表示のみ -->
      <section class="section">
        <h3 class="section__title">
          日程調整
        </h3>
        <p class="section__value">
          {{ scheduleStateLabel }}
        </p>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background-color: var(--color-canvas);
}

.detail__head {
  display: flex;
  flex: none;
  gap: var(--space-sm);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-hairline);
}

.detail__title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.detail__empty {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.detail__empty {
  padding: var(--space-xxl) var(--space-lg);
  text-align: center;
}

.detail__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-lg);
}

.detail__student {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  align-items: flex-start;
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-hairline);
}

.detail__name {
  font-size: 16px;
  font-weight: 700;
}

.detail__university {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.section {
  padding: var(--space-lg) 0;
}

.section + .section {
  border-top: 1px solid var(--color-hairline);
}

.section__title {
  margin-bottom: var(--space-sm);
  font-size: 12px;
  font-weight: 700;
}

.section__value {
  display: inline-flex;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-pill);
  background-color: var(--color-orange-soft);
  font-size: 12px;
}
</style>
