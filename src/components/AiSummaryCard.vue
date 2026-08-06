<script setup>
// ホーム右カラムの AI 現況サマリー／TODO（P3-1a・business-logic.md §7-2）
//
// ★中身の生成はまだ実装していない。
//   roomsStore.fetchAiSummary() / regenerateAiSummary() がサーバ未実装のため
//   常に unavailable（準備中）を返す。P3-1a で GET/POST /api/ai/summary を繋げば
//   このコンポーネントは**変更なしで**動くよう、5状態すべてを描き分けてある。
//
// AI が落ちてもホームの一覧は動き続けること（business-logic.md §7-2）。
// このカードはエラーを表示するだけで、例外を外へ投げない。
import { computed } from "vue"
import { AI_SUMMARY_STATUS, AI_SUMMARY_STATUS_META } from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"

// #region constants
const TITLE = "AI 現況サマリー"
/** ローディング中に出すスケルトンの行数 */
const SKELETON_LINES = 3
// #endregion

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region computed
const summary = computed(() => rooms.aiSummary)

const statusLabel = computed(() => AI_SUMMARY_STATUS_META[summary.value.status]?.label ?? "")

const isLoading = computed(() => summary.value.status === AI_SUMMARY_STATUS.LOADING)

const isReady = computed(() => summary.value.status === AI_SUMMARY_STATUS.READY)

const isError = computed(() => summary.value.status === AI_SUMMARY_STATUS.ERROR)

/** APIキー未設定。再生成しても無駄なのでボタンを止める */
const isUnavailable = computed(() => summary.value.status === AI_SUMMARY_STATUS.UNAVAILABLE)

const canGenerate = computed(() => !isLoading.value && !isUnavailable.value)

/** 未生成・準備中に出す案内文 */
const placeholderText = computed(() => {
  if (isUnavailable.value) return "AI 要約は準備中です。実装後、ログイン時に自動で生成されます。"
  if (isError.value) return summary.value.error || "要約の生成に失敗しました。"
  return "「要約を生成」を押すと、いま対応すべき学生を AI がまとめます。"
})

// 保存・送受信は UTC、表示のみローカル変換（CLAUDE.md §6-2）
const generatedAtText = computed(() => {
  if (!summary.value.generatedAt) return ""
  const date = new Date(summary.value.generatedAt)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 時点`
})
// #endregion

// #region browser event handler
const onGenerate = () => rooms.regenerateAiSummary()
// #endregion
</script>

<template>
  <section
    class="ai-card"
    aria-labelledby="ai-card-title"
  >
    <header class="ai-card__head">
      <span
        class="ai-card__mark"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3.5 l1.9 4.6 l4.6 1.9 l-4.6 1.9 l-1.9 4.6 l-1.9-4.6 l-4.6-1.9 l4.6-1.9 z" />
          <path d="M18 15.5 l.8 2 l2 .8 l-2 .8 l-.8 2 l-.8-2 l-2-.8 l2-.8 z" />
        </svg>
      </span>

      <span class="ai-card__heading">
        <h2
          id="ai-card-title"
          class="ai-card__title"
        >{{ TITLE }}</h2>
        <!-- 状態は色だけでなくテキストでも伝える（CLAUDE.md §6-13） -->
        <span
          class="ai-card__status"
          :class="`ai-card__status--${summary.status}`"
        >{{ statusLabel }}</span>
      </span>

      <button
        type="button"
        class="icon-button ai-card__close"
        title="AI サマリーを閉じる"
        aria-label="AI サマリーを閉じる"
        @click="ui.toggleAiPanel()"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <div class="ai-card__body">
      <!-- 生成中：内容の形を先に見せて、出来上がりの高さを予告する -->
      <div
        v-if="isLoading"
        class="skeleton"
        role="status"
      >
        <span class="sr-only">要約を生成しています</span>
        <span
          v-for="line in SKELETON_LINES"
          :key="line"
          class="skeleton__line"
          aria-hidden="true"
        />
      </div>

      <template v-else-if="isReady">
        <p class="situation">
          {{ summary.situation }}
        </p>

        <h3 class="todo__caption">
          いま対応すべきこと
        </h3>
        <ol class="todo">
          <li
            v-for="(todo, index) in summary.todos"
            :key="todo.roomId"
            class="todo__item"
          >
            <RouterLink
              class="todo__link"
              :to="`/inbox/${todo.roomId}`"
            >
              <span
                class="todo__index"
                aria-hidden="true"
              >{{ index + 1 }}</span>
              <span class="todo__text">
                <span class="todo__action">{{ todo.studentName }}：{{ todo.action }}</span>
                <span class="todo__reason">{{ todo.reason }}</span>
              </span>
            </RouterLink>
          </li>
        </ol>
      </template>

      <!-- idle / error / unavailable -->
      <p
        v-else
        class="placeholder"
        :class="{ 'placeholder--error': isError }"
      >
        {{ placeholderText }}
      </p>
    </div>

    <footer class="ai-card__foot">
      <span class="ai-card__timestamp">{{ generatedAtText }}</span>
      <button
        type="button"
        class="button-normal ai-card__generate"
        :disabled="!canGenerate"
        :title="isUnavailable ? 'AI 機能は未実装です' : undefined"
        @click="onGenerate"
      >
        {{ isReady ? "更新" : "要約を生成" }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.ai-card {
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

/* AI であることを一目で分かるようにラベンダー寄りのグラデーションを敷く。
   ブランドのオレンジは CTA に取っておく（DESIGN.md："Keep orange scarce"） */
.ai-card__head {
  display: flex;
  flex: none;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-hairline);
  background-image: linear-gradient(
    135deg,
    var(--color-canvas-lavender) 0%,
    var(--color-orange-soft) 100%
  );
}

.ai-card__mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-3);
  color: var(--color-primary);
}

.ai-card__mark svg {
  width: 18px;
  height: 18px;
}

.ai-card__heading {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ai-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.ai-card__status {
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 600;
}

.ai-card__status--ready {
  color: var(--color-bubble-mine);
}

.ai-card__status--error {
  color: var(--color-error);
}

.ai-card__close {
  align-self: flex-start;
  background-color: transparent;
  font-size: 16px;
}

.ai-card__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-lg);
}

/* --- 生成済み --- */
.situation {
  margin: 0;
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: color-mix(in srgb, var(--color-canvas-lavender) 60%, var(--color-canvas));
  font-size: 13px;
  line-height: 1.7;
}

.todo__caption {
  margin: var(--space-lg) 0 var(--space-sm);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.todo {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.todo__link {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-lg);
  color: inherit;
  text-decoration: none;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.todo__link:hover {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-hairline));
  background-color: var(--color-orange-soft);
  color: inherit;
}

.todo__index {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: 700;
}

.todo__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.todo__action {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.todo__reason {
  color: var(--color-ink-mute);
  font-size: 11px;
}

/* --- 未生成・エラー・準備中 ---
   中身が1文しかないので、カードの上に貼り付けず縦中央に置く */
.placeholder {
  margin: auto 0;
  padding: var(--space-lg) var(--space-md);
  border: 1px dashed var(--color-hairline);
  border-radius: var(--radius-lg);
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}

.placeholder--error {
  border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
  color: var(--color-error);
}

/* --- 生成中 --- */
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.skeleton__line {
  height: 12px;
  border-radius: var(--radius-sm);
  background-image: linear-gradient(
    90deg,
    var(--color-hairline) 0%,
    color-mix(in srgb, var(--color-hairline) 40%, var(--color-canvas)) 50%,
    var(--color-hairline) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton__line:last-child {
  width: 60%;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton__line {
    animation: none;
  }
}

/* --- フッタ --- */
.ai-card__foot {
  display: flex;
  flex: none;
  gap: var(--space-sm);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--color-hairline);
}

.ai-card__timestamp {
  color: var(--color-ink-mute);
  font-size: 11px;
}

.ai-card__generate {
  padding: 6px 16px;
  font-size: 12px;
}
</style>
