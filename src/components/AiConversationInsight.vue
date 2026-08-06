<script setup>
import { computed } from "vue"
import {
  AI_ANALYSIS_STATUS,
  AI_RECOMMENDED_PRIORITY,
  AI_RECOMMENDED_PRIORITY_META,
} from "../constants/index.js"

const props = defineProps({
  recommendation: { type: Object, default: null },
})

const isVisible = computed(
  () =>
    props.recommendation?.status === AI_ANALYSIS_STATUS.COMPLETED &&
    Boolean(props.recommendation?.requestedAction)
)

const isHigh = computed(
  () => props.recommendation?.priority === AI_RECOMMENDED_PRIORITY.HIGH
)

const priorityLabel = computed(
  () => AI_RECOMMENDED_PRIORITY_META[props.recommendation?.priority]?.label ?? ""
)
</script>

<template>
  <section
    v-if="isVisible"
    class="insight"
    aria-labelledby="ai-insight-title"
  >
    <div class="insight__head">
      <h2 id="ai-insight-title">
        AIによる会話整理
      </h2>
      <span
        v-if="isHigh"
        class="insight__priority"
      >AI対応推奨度：{{ priorityLabel }}</span>
    </div>

    <dl class="insight__details">
      <div>
        <dt>求めていること</dt>
        <dd>{{ recommendation.requestedAction }}</dd>
      </div>
      <div v-if="recommendation.contextSummary">
        <dt>注意すべき背景</dt>
        <dd>{{ recommendation.contextSummary }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.insight {
  flex: none;
  margin: var(--space-md) max(var(--space-xxl), calc((100% - var(--chat-column-max)) / 2)) 0;
  padding: var(--space-md) var(--space-lg);
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-hairline));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-canvas));
}

.insight__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}

.insight__head h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.insight__priority {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: white;
  font-size: 11px;
  font-weight: 700;
}

.insight__details {
  display: grid;
  gap: var(--space-sm);
  margin: var(--space-sm) 0 0;
}

.insight__details dt {
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
}

.insight__details dd {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>
