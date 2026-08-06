<script setup>
// 選考フローの進捗図（S-09 / P2-11・frontend.md §7-3）
//
// 丸＋つなぎ線で「いま自分がどこにいるか」を示す。番号を振るのは、選考が
// 順序に意味のある本物の手順だから（順序が情報でないものに番号を付けない）。
//
// ★つなぎ線は SVG で1本のパスとして描く。
//   丸ごとに疑似要素で線を引くと、線が丸の上に重なって描画される（DOM 順の問題）うえに、
//   現在地を持ち上げた「山」の形に線を追従させられない。
//   実際の丸の位置を測ってから1本の曲線として引くことで、両方をまとめて解く。
//
// 配色：
//   通過済み … オレンジ（歩いてきた道）
//   進行中   … オレンジの塗り＋持ち上げ（山の頂上）
//   これから … 薄いグレー（まだ手つかず）
//
// ★色だけで状態を伝えない（CLAUDE.md §6-13）。各ノードに状態のテキストを必ず持たせる。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { FLOW_STEP_STATE, FLOW_STEP_STATE_META } from "../constants/index.js"

const props = defineProps({
  /** @type {{statusKey: string, label: string, state: string, feedback: object|null,
   *          isUnreadFeedback: boolean}[]} */
  steps: { type: Array, required: true },
  /** 選択中のステップ（詳細を表示しているもの） */
  selectedKey: { type: String, default: null },
})

const emit = defineEmits(["select"])

// #region constants
/**
 * 入場アニメーションの間隔（ms）。
 * ★体感を止めないことを最優先にする。1ノードあたり 35ms・全体で 500ms 以内に収める。
 *   遅延は 8 番目で頭打ちにして、ステップが増えても待ち時間が伸びないようにする。
 */
const STAGGER_MS = 35
const MAX_STAGGER_INDEX = 8

/**
 * 山の形は**正規分布（ガウス関数）そのもの**で決める。
 *   lift(x) = -PEAK_LIFT * exp(-(x - 頂点x)^2 / (2 * σ^2))
 *
 * 丸の持ち上げ量も線の高さも同じ式から出すので、線は必ず丸の中心を通る。
 * σ をステップ間隔に対する比で持つことで、ステップ数や画面幅が変わっても
 * 裾野の広がり方（山の“なだらかさ”）が一定になる。
 */
const PEAK_LIFT = 28
const SIGMA_RATIO = 0.8

/** 曲線を折れ線で近似するときの刻み幅（px）。細かいほど滑らかになる */
const SAMPLE_PX = 4

/** SVG の描画領域の高さ。丸（44px）＋持ち上げ＋余白が収まる値 */
const RAIL_AREA_HEIGHT = 88
// #endregion

// #region local state
/**
 * 入場アニメーションはマウント直後の1回だけ。
 * 詳細を開くたびに再生すると、操作のたびに図が動いて鬱陶しい。
 */
const entered = ref(false)

/** @type {import('vue').Ref<HTMLElement|null>} 座標の基準になる外枠 */
const trackRef = ref(null)

/**
 * 各ノードの丸の要素。中心座標を測るためだけに持つ。
 * 描画に使わないので ref にしない（描画中に書き換えて余計な再描画を起こさないため）。
 * @type {HTMLElement[]}
 */
const dotEls = []
const setDotRef = (el, index) => {
  dotEls[index] = el
}

/**
 * 実測したレイアウト（trackRef の左上が原点）。
 * ★持ち上げる前の位置を持つ。持ち上げは transform で与えるので、
 *   持ち上げ後の丸を測ると「測った値から持ち上げを計算する」循環になる。
 */
const layout = ref({ xs: [], baseY: 0, width: 0 })

let resizeObserver = null
// #endregion

// #region computed
const currentIndex = computed(() =>
  props.steps.findIndex((step) => step.state === FLOW_STEP_STATE.CURRENT)
)

/** 丸の間隔（px）。σ の基準になる */
const spacing = computed(() => {
  const { xs } = layout.value
  if (xs.length < 2) return 0
  return (xs[xs.length - 1] - xs[0]) / (xs.length - 1)
})

/** 山の頂点の x。現在地が無い（内定・辞退・未設定）ときは山を作らない */
const peakX = computed(() => {
  if (currentIndex.value === -1) return null
  return layout.value.xs[currentIndex.value] ?? null
})

const lifts = computed(() => layout.value.xs.map((x) => liftAt(x)))

const nodes = computed(() =>
  props.steps.map((step, index) => ({
    ...step,
    order: index + 1,
    isDone: step.state === FLOW_STEP_STATE.DONE,
    isCurrent: step.state === FLOW_STEP_STATE.CURRENT,
    stateLabel: FLOW_STEP_STATE_META[step.state]?.label ?? "",
    hasFeedback: Boolean(step.feedback),
    /** まだ読んでいないFB。未読だけを動かして、読んだら静かにする */
    isUnread: Boolean(step.isUnreadFeedback),
    delayMs: Math.min(index, MAX_STAGGER_INDEX) * STAGGER_MS,
    /** 丸の持ち上げ量。線と同じガウス関数から出すので、線は必ず中心を通る */
    lift: lifts.value[index] ?? 0,
  }))
)

/**
 * 通過済みの区間（先頭 → 現在地）。歩いてきた道としてオレンジで引く。
 * 現在地が無い（内定・未設定）ときは、完了しているところまでを塗る。
 */
const pastEndIndex = computed(() => {
  if (currentIndex.value !== -1) return currentIndex.value

  let lastDone = -1
  props.steps.forEach((step, index) => {
    if (step.state === FLOW_STEP_STATE.DONE) lastDone = index
  })
  return lastDone
})

const pastPath = computed(() => {
  const { xs } = layout.value
  if (xs.length < 2 || pastEndIndex.value < 1) return ""
  return buildCurve(xs[0], xs[pastEndIndex.value])
})

/** これからの区間。現在地から先を薄いグレーで引く */
const futurePath = computed(() => {
  const { xs } = layout.value
  if (xs.length < 2) return ""
  return buildCurve(xs[Math.max(pastEndIndex.value, 0)], xs[xs.length - 1])
})
// #endregion

// #region local methods
/**
 * 正規分布（ガウス関数）による持ち上げ量。
 *
 *   lift(x) = -PEAK_LIFT * exp(-(x - peakX)^2 / (2σ^2))
 *
 * 丸の位置でも線の途中でも同じ式を使うので、線は必ず丸の中心を通る。
 */
function liftAt(x) {
  if (peakX.value === null || spacing.value === 0) return 0

  const sigma = spacing.value * SIGMA_RATIO
  const distance = x - peakX.value
  return -PEAK_LIFT * Math.exp(-(distance * distance) / (2 * sigma * sigma))
}

/**
 * ガウス曲線を折れ線で近似する。
 * ベジェで丸から丸へ繋ぐと「区間ごとの S 字」になって裾野が膨らむので、
 * 曲線そのものを細かく標本化する。4px 刻みなら見た目は完全になめらか。
 */
function buildCurve(fromX, toX) {
  if (!(toX > fromX)) return ""

  const { baseY } = layout.value
  const commands = []
  for (let x = fromX; x < toX; x += SAMPLE_PX) {
    commands.push(`${x.toFixed(1)} ${(baseY + liftAt(x)).toFixed(1)}`)
  }
  commands.push(`${toX.toFixed(1)} ${(baseY + liftAt(toX)).toFixed(1)}`)

  return `M ${commands.join(" L ")}`
}

/**
 * 丸の「持ち上げる前の」中心を測る。
 *
 * ★持ち上げは transform で与えるため、持ち上げ後の丸を測ると
 *   「測った値 → 持ち上げ量 → 測った値」の循環になる。
 *   transform が掛かっていない親（ボタン）を基準にすることで循環を断つ。
 */
function measure() {
  const track = trackRef.value
  if (!track) return

  const base = track.getBoundingClientRect()
  // ステップが減ったときに前回の要素が残らないよう、今の件数で切る
  const dots = dotEls.slice(0, props.steps.length).filter(Boolean)

  const xs = dots.map((dot) => {
    const rect = dot.parentElement.getBoundingClientRect()
    return rect.left - base.left + rect.width / 2
  })

  const first = dots[0]
  const baseY = first
    ? first.parentElement.getBoundingClientRect().top - base.top + first.offsetHeight / 2
    : 0

  layout.value = { xs, baseY, width: base.width }
}

const scheduleMeasure = () => nextTick(measure)
// #endregion

// #region lifecycle
onMounted(async () => {
  entered.value = true
  await nextTick()
  measure()

  // 幅が変わると丸の間隔が変わるので、線も引き直す
  if (typeof ResizeObserver !== "undefined" && trackRef.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(trackRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

// ステップの増減・現在地の移動で山の形が変わる
watch(() => props.steps, scheduleMeasure, { deep: true })
// #endregion
</script>

<template>
  <div
    class="flow"
    :class="{ 'flow--entered': entered }"
  >
    <div
      ref="trackRef"
      class="flow__area"
    >
      <!-- つなぎ線。丸の下に敷く（丸に重ならないよう z-index で明示的に沈める） -->
      <svg
        class="flow__rails"
        :width="layout.width"
        :height="RAIL_AREA_HEIGHT"
        aria-hidden="true"
        focusable="false"
      >
        <path
          v-if="futurePath"
          class="flow__rail flow__rail--future"
          :d="futurePath"
        />
        <!-- pathLength="1" で長さを正規化する。線を引くアニメーションを
             ステップ数や画面幅に依存しない指定にするため -->
        <path
          v-if="pastPath"
          class="flow__rail flow__rail--past"
          :d="pastPath"
          path-length="1"
        />
      </svg>

      <ol class="flow__track">
        <li
          v-for="(node, index) in nodes"
          :key="node.statusKey"
          class="flow__step"
          :class="{
            'flow__step--done': node.isDone,
            'flow__step--current': node.isCurrent,
          }"
          :style="{ '--delay': `${node.delayMs}ms`, '--lift': `${node.lift}px` }"
        >
          <button
            type="button"
            class="flow__node"
            :aria-current="node.isCurrent ? 'step' : undefined"
            :aria-pressed="node.statusKey === selectedKey"
            @click="emit('select', node.statusKey)"
          >
            <span
              :ref="(el) => setDotRef(el, index)"
              class="flow__dot"
            >
              <!-- 完了はチェック、それ以外は順番の番号 -->
              <svg
                v-if="node.isDone"
                class="flow__check"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  d="M3.5 8.5l3 3 6-6.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span
                v-else
                aria-hidden="true"
              >{{ node.order }}</span>

              <!-- 完了ステップに企業からのFBが届いているときの目印。
                   未読は塗り＋パルス、既読は輪郭だけにして静かにする -->
              <span
                v-if="node.hasFeedback"
                class="flow__mark"
                :class="node.isUnread ? 'flow__mark--unread' : 'flow__mark--read'"
                aria-hidden="true"
              />
            </span>

            <span class="flow__label">{{ node.label }}</span>

            <!-- 画面に出す短いラベルは1つだけ。
                 「進行中」と「新着」は同時に起きない（進行中ステップのFBはサーバが返さない） -->
            <span
              v-if="node.isCurrent || node.isUnread"
              class="flow__state"
            >{{ node.isCurrent ? node.stateLabel : "新着" }}</span>

            <!-- 読み上げ用。画面に出ていない状態は必ずここで補う（色と動きだけで伝えない） -->
            <span
              v-if="!node.isCurrent"
              class="sr-only"
            >{{ node.stateLabel }}</span>

            <span
              v-if="node.hasFeedback"
              class="sr-only"
            >企業からのフィードバックあり{{ node.isUnread ? "（未読）" : "" }}</span>
          </button>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.flow {
  --node-size: 44px;
  /* 現在地が上へ出る量の合計：持ち上げ 24px ＋ リング 5px ＋ 拡大ぶん 3px ＋ パルス。
     ★overflow-x: auto を指定すると overflow-y も auto に計算されるため、
       ここで余白を取っておかないと持ち上げた丸とリングが上で切れる */
  --lift-clearance: 44px;

  overflow-x: auto;
  padding: var(--lift-clearance) 0 var(--space-xs);
}

.flow__area {
  position: relative;
  min-width: min-content;
}

/* 線は丸の下。z-index を明示しないと、後に来る要素として丸の上に載る */
.flow__rails {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.flow__rail {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
}

/* これから：薄いグレーで、まだ手つかずであることを示す */
.flow__rail--future {
  stroke: var(--color-hairline);
}

/* 通過済み：歩いてきた道をオレンジで残す */
.flow__rail--past {
  stroke: var(--color-primary);
}

.flow--entered .flow__rail--past {
  animation: rail-draw 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 線を左から引く。pathLength を 1 に正規化して長さに依存しない指定にする */
@keyframes rail-draw {
  from {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }
  to {
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
  }
}

.flow__track {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  min-width: min-content;
  margin: 0;
  padding: 0;
  list-style: none;
}

.flow__step {
  flex: 1 1 0;
  /* 「最終面接」など長めのラベルが折り返さない幅 */
  min-width: 104px;
  max-width: 168px;
}

/* --- ノード --- */
.flow__node {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
  padding: 0 var(--space-xs);
  border: 0;
  background: none;
  cursor: pointer;
}

.flow__dot {
  /* 現在地リング（::after）と FB の目印を「丸」の基準で置くために必要 */
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--node-size);
  height: var(--node-size);
  border: 2px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  /* これから：まだ手つかずであることが伝わるよう薄いグレーに沈める。
     ラベル（下の文字）は読める濃さのまま残す */
  color: color-mix(in srgb, var(--color-ink-mute) 60%, var(--color-canvas));
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  /* 山の高さ（--lift）と入場の立ち上がりを1つの transform にまとめる。
     レイアウトは動かさないので、ラベルの位置は揃ったままになる */
  opacity: 0;
  transform: translateY(var(--lift)) scale(0.85);
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease;
}

.flow--entered .flow__dot {
  opacity: 1;
  transform: translateY(var(--lift)) scale(1);
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 140ms ease,
    background-color 140ms ease;
  transition-delay: var(--delay);
}

/* 通過済み：オレンジ。塗りは薄く、線と文字で色を出す */
.flow__step--done .flow__dot {
  border-color: var(--color-primary);
  background-color: var(--color-orange-soft);
  color: var(--color-primary);
}

/* 現在地：山の頂上。塗りつぶし＋一回り大きく＋影で持ち上げる */
.flow--entered .flow__step--current .flow__dot {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-2);
  transform: translateY(var(--lift)) scale(1.14);
}

/* 現在地のリング。面の外側に広がるのでレイアウトには影響しない */
.flow__step--current .flow__dot::after {
  position: absolute;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-pill);
  content: "";
  inset: -5px;
  opacity: 0.3;
}

.flow--entered .flow__step--current .flow__dot::after {
  animation: flow-pulse 2.4s ease-in-out infinite;
  /* 入場が終わってから始める */
  animation-delay: calc(var(--delay) + 300ms);
}

@keyframes flow-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0;
    transform: scale(1.2);
  }
}

.flow__check {
  width: 18px;
  height: 18px;
}

/* FB が届いている目印。丸の右上の弧の上に載せる。
   外側の白い縁は、ノードの枠線と点が溶け合わないようにするためのもの */
.flow__mark {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border: 2px solid var(--color-canvas);
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
}

/* 既読：塗りを白に落とし、輪郭だけ残して静かにする。
   「FBがある」ことは伝え続けるが、もう学生を呼ばない */
.flow__mark--read {
  background-color: var(--color-canvas);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* 未読：点の外へ広がる波。現在地リングと同じ 2.4s の言語に揃える。
   ★動かすのは transform と opacity だけ。
     .flow__dot が transform を持つためスタッキングコンテキストが立っており、
     z-index: -1 は「丸の面より前・点の塗りより後ろ」に収まる */
.flow__mark--unread::after {
  position: absolute;
  z-index: -1;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
  content: "";
  inset: -2px;
}

.flow--entered .flow__mark--unread::after {
  animation: mark-pulse 2.4s ease-in-out infinite;
}

@keyframes mark-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(1);
  }
  50% {
    opacity: 0;
    transform: scale(2.1);
  }
}

/* これからのステップのラベル。丸ほどは薄くしない（読めなくなるため） */
.flow__label {
  color: color-mix(in srgb, var(--color-ink-mute) 80%, var(--color-canvas));
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  transition: color 140ms ease;
}

.flow__step--done .flow__label {
  color: var(--color-ink);
}

.flow__step--current .flow__label {
  color: var(--color-ink);
  font-weight: 700;
}

.flow__state {
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
}

/* --- 操作の状態 --- */
.flow__node:hover .flow__dot {
  border-color: var(--color-primary);
}

.flow__node:hover .flow__label {
  color: var(--color-ink);
}

.flow__node:focus-visible {
  outline: none;
}

.flow__node:focus-visible .flow__dot {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

/* 詳細を開いているステップ */
.flow__node[aria-pressed="true"] .flow__label {
  color: var(--color-ink);
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .flow__dot,
  .flow--entered .flow__dot {
    opacity: 1;
    transition: none;
  }

  .flow--entered .flow__rail--past {
    animation: none;
  }

  .flow--entered .flow__step--current .flow__dot::after {
    animation: none;
  }

  /* パルスは止めるが、点そのものは残す（未読は塗り・既読は輪郭で見分けられる） */
  .flow--entered .flow__mark--unread::after {
    animation: none;
  }
}
</style>
