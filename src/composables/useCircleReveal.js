// ログイン → ホームの円形トランジション（拡大 → 画面差し替え → 中心の移動 → 収束）。
//
// 進行はここで指揮し、描画は components/CircleRevealOverlay.vue が受け持つ。
// 状態は ui ストア（circleReveal）に置いてあるので、ログイン画面が
// アンマウントされたあと（＝ホーム表示中）も同じ円を動かし続けられる。
//
// 流れ：
//   1. ログイン画面のロゴの円の中心から、画面を覆いきる倍率まで拡大する
//   2. 覆いきったところで裏側をホームへ差し替える（navigate）
//   3. **transition を切って**中心をナビレールのロゴの円へ移す（横滑りを見せない）
//   4. その中心へ向かって収束させ、ホームを現す
import { nextTick } from "vue"
import { CIRCLE_REVEAL_PHASE, useUiStore } from "../stores/ui.js"
import { LOGO_MARK, findLogoMark, getLogoMarkCircle } from "../utils/logoMark.js"

// #region constants
/**
 * 円の基準直径（px）。scale=1 のときの実寸で、CircleRevealOverlay の width/height と対になる。
 *
 * ロゴの円（30px 前後）を基準にすると画面を覆うまでに 80 倍ほど引き伸ばすことになり、
 * 合成レイヤの再ラスタライズが追いつかず輪郭がぼける。逆に画面対角ぶんの実寸を持たせると
 * レイヤが巨大になる。両方を避けられる中間の値として 400px を採る（拡大は最大でも 5 倍程度）。
 */
export const CIRCLE_REVEAL_BASE_DIAMETER = 400

const BASE_RADIUS = CIRCLE_REVEAL_BASE_DIAMETER / 2

/** 拡大：一気に立ち上がって画面を飲み込む（easeInOutQuint 相当） */
const EXPAND = Object.freeze({
  durationMs: 520,
  easing: "cubic-bezier(0.83, 0, 0.17, 1)",
})

/** 収束：勢いよく引いてから静かに着地する（easeOutQuint 相当） */
const COLLAPSE = Object.freeze({
  durationMs: 640,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
})

/** 着地したロゴの円との継ぎ目を見せないための、最後のごく短いフェード */
const FADE = Object.freeze({
  durationMs: 140,
  easing: "linear",
})

/** 覆っている間の“ため”。ホームが最初の描画を終える猶予でもある */
const HOLD_MS = 120

/** transitionend が来ない場合（タブが裏に回った等）に進行を止めないための上乗せ */
const TRANSITION_SAFETY_MS = 250
// #endregion

// #region local methods
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 直前に当てたスタイルを確定させる。
 * これを挟まないと「transition を切って中心を移す → transition を戻す」が
 * 同じスタイル計算にまとめられ、円が新しい中心へスライドして見えてしまう。
 */
function forceReflow(el) {
  // 参照するだけでレイアウトが同期的に走る（値は使わない）
  void el.getBoundingClientRect()
}

/**
 * transform の transition 完了を待つ。取りこぼしに備えてタイムアウトと競争させる。
 * @param {HTMLElement} el
 * @param {number} durationMs
 */
function waitForTransform(el, durationMs) {
  return new Promise((resolve) => {
    const finish = () => {
      el.removeEventListener("transitionend", onEnd)
      clearTimeout(timer)
      resolve()
    }
    const onEnd = (event) => {
      if (event.target === el && event.propertyName === "transform") finish()
    }
    const timer = setTimeout(finish, durationMs + TRANSITION_SAFETY_MS)
    el.addEventListener("transitionend", onEnd)
  })
}

/**
 * (x, y) を中心にした円が画面を覆いきる倍率。
 * 四隅までの距離のうち最も遠いものが必要な半径になる。端に隙間が出ないよう少しだけ余らせる。
 */
function coverScale(x, y) {
  const width = window.innerWidth
  const height = window.innerHeight
  const radius = Math.max(
    Math.hypot(x, y),
    Math.hypot(width - x, y),
    Math.hypot(x, height - y),
    Math.hypot(width - x, height - y)
  )
  return (radius + 2) / BASE_RADIUS
}

/** OS 側で「視差効果を減らす」が有効なら、アニメーションは行わず即座に切り替える */
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
// #endregion

/**
 * @returns {{ revealToHome: (navigate: () => unknown) => Promise<void> }}
 */
export function useCircleReveal() {
  const ui = useUiStore()

  /**
   * ログイン画面のロゴの円から広げ、覆っている間に navigate を実行し、
   * ナビレールのロゴの円へ収束する。
   *
   * ロゴが見つからない・視差効果を減らす設定・すでに再生中、のいずれでも
   * アニメーションは諦めて navigate だけ行う（遷移そのものは必ず起こす）。
   *
   * @param {() => unknown} navigate 画面を切り替える処理（router.replace など）
   */
  const revealToHome = async (navigate) => {
    const origin = getLogoMarkCircle(findLogoMark(LOGO_MARK.AUTH))
    const busy = ui.circleReveal.phase !== CIRCLE_REVEAL_PHASE.IDLE

    if (!origin || busy || prefersReducedMotion()) {
      await navigate()
      return
    }

    // --- 1. ロゴの円にぴったり重ねた状態から始める（transition なしで置く） ---
    ui.patchCircleReveal({
      phase: CIRCLE_REVEAL_PHASE.EXPANDING,
      x: origin.x,
      y: origin.y,
      scale: origin.radius / BASE_RADIUS,
      opacity: 1,
      eased: false,
      ...EXPAND,
    })
    await nextTick()

    const circle = document.querySelector("[data-circle-reveal]")
    if (!circle) {
      ui.resetCircleReveal()
      await navigate()
      return
    }
    forceReflow(circle)

    // --- 2. 画面を覆いきるまで拡大する ---
    const expandedScale = coverScale(origin.x, origin.y)
    ui.patchCircleReveal({ eased: true, scale: expandedScale })
    await nextTick()
    await waitForTransform(circle, EXPAND.durationMs)

    // --- 3. 覆われている裏側でホームへ差し替える ---
    ui.patchCircleReveal({ phase: CIRCLE_REVEAL_PHASE.COVERED })
    await navigate()
    // ナビレールが DOM に入るのを待つ（座標は getBoundingClientRect が
    // 同期でレイアウトを走らせて測るので、描画フレームまでは待たなくてよい）。
    // ★ここで requestAnimationFrame を待たない。裏に回ったタブではフレームが
    //   来ず、オレンジで覆ったまま止まってしまうため。進行は必ずタイマーで進める
    await nextTick()
    await wait(HOLD_MS)

    // --- 4. 中心をレールのロゴへ移す。transition は切っておく（横滑り防止） ---
    const target = getLogoMarkCircle(findLogoMark(LOGO_MARK.RAIL)) ?? origin
    // 中心が変われば四隅までの距離も変わる。移動で画面の端が覗かないよう大きい方に合わせる
    const coveredScale = Math.max(expandedScale, coverScale(target.x, target.y))
    ui.patchCircleReveal({ eased: false, x: target.x, y: target.y, scale: coveredScale })
    await nextTick()
    forceReflow(circle)

    // --- 5. 新しい中心へ収束させ、ホームを現す ---
    ui.patchCircleReveal({
      phase: CIRCLE_REVEAL_PHASE.COLLAPSING,
      eased: true,
      scale: target.radius / BASE_RADIUS,
      ...COLLAPSE,
    })
    await nextTick()
    await waitForTransform(circle, COLLAPSE.durationMs)

    // --- 6. ロゴの円に重なった状態で消す。真上に載っているので一瞬だけ溶かす ---
    ui.patchCircleReveal({ opacity: 0, ...FADE })
    await wait(FADE.durationMs)
    ui.resetCircleReveal()
  }

  return { revealToHome }
}
