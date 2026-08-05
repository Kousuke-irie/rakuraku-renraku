<script setup>
// 学生・人事のアイコン（avatar_color の丸＋イニシャル・frontend.md §7）
// ※ vue/multi-word-component-names のため単語1つの Avatar ではなく UserAvatar とする
import { computed } from "vue"

// #region constants
const FALLBACK_COLOR = "#8B8D98"
const FALLBACK_INITIAL = "?"
// #endregion

const props = defineProps({
  /** 表示名。先頭1文字をイニシャルとして使う */
  displayName: { type: String, default: "" },
  /** users.avatar_color。未設定なら既定のグレー */
  color: { type: String, default: "" },
  /** sm=24px / md=32px / lg=40px */
  size: {
    type: String,
    default: "md",
    // defineProps は setup スコープの変数を参照できないため配列をここに直接書く
    validator: (value) => ["sm", "md", "lg"].includes(value),
  },
})

// #region computed
// 絵文字などのサロゲートペアで壊れないよう Array.from で1文字目を取る
const initial = computed(() => {
  const name = props.displayName.trim()
  if (!name) return FALLBACK_INITIAL
  return Array.from(name)[0]
})

const backgroundColor = computed(() => props.color || FALLBACK_COLOR)
// #endregion
</script>

<template>
  <span
    class="avatar"
    :class="`avatar--${size}`"
    :style="{ backgroundColor }"
    role="img"
    :aria-label="displayName || undefined"
  >{{ initial }}</span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 600;
  line-height: 1;
  user-select: none;
}

.avatar--sm {
  width: 24px;
  height: 24px;
  font-size: 12px;
}

.avatar--md {
  width: 32px;
  height: 32px;
  font-size: 14px;
}

.avatar--lg {
  width: 40px;
  height: 40px;
  font-size: 16px;
}
</style>
