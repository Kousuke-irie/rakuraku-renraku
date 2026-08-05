<script setup>
// 未読数バッジ（P1-1・frontend.md §6：行の右端に青丸バッジ＋件数）
import { computed } from "vue"

const props = defineProps({
  /** 未読件数。0 なら何も描画しない */
  count: { type: Number, default: 0 },
  /** これを超えたら "99+" 表記にする */
  max: { type: Number, default: 99 },
})

// #region computed
const visible = computed(() => props.count > 0)

const text = computed(() => (props.count > props.max ? `${props.max}+` : String(props.count)))
// #endregion
</script>

<template>
  <span
    v-if="visible"
    class="unread-badge"
    :aria-label="`未読${count}件`"
  >{{ text }}</span>
</template>

<style scoped>
.unread-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: #2563eb;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
</style>
