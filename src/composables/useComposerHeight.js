// 入力欄（composer）の高さ制御
//
// 定型文（P2-1）を展開したときなど、長文が3行の枠に収まらず視認性が落ちる問題への対処。
//
// 1. 自動追従：本文の行数に応じて枠が伸び縮みする（下限3行・上限は画面の半分まで）
// 2. 手動指定：つまみをドラッグすると高さを固定できる（ComposerResizeHandle）
//
// 手動指定があるあいだは本文に追従しない（ユーザーが決めた高さを勝手に変えないため）。
// つまみのダブルクリックで手動指定を捨て、自動追従に戻す。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** 入力欄の高さ（px）。行送りは .composer__input の font-size 15px × line-height 1.6 = 24px */
export const COMPOSER_HEIGHT = Object.freeze({
  /** 下限＝3行ぶん（24px × 3）＋ .composer__input の padding-top 4px */
  MIN: 76,
  /** 上限の絶対値。これを超えると入力欄の中でスクロールする */
  MAX: 420,
  /** 上限は画面高のこの割合までに抑える（トーク履歴が潰れないようにするため） */
  MAX_VIEWPORT_RATIO: 0.5,
  /** キーボード操作 1回あたりの変化量＝1行 */
  STEP: 24,
})

/**
 * @param {import('vue').Ref<string>} value 入力欄にバインドしている本文
 * @returns 入力欄に付ける ref / 高さ / つまみ用の状態
 */
export function useComposerHeight(value) {
  /** 入力欄の <textarea>。呼び出し側が ref="..." で結び付ける */
  const textareaRef = ref(null)

  /** @type {import('vue').Ref<number|null>} つまみで指定された高さ。null なら自動追従 */
  const manualHeight = ref(null)

  /** 本文から算出した高さ */
  const autoHeight = ref(COMPOSER_HEIGHT.MIN)

  /** 画面が低いときに上限を下げるため、ビューポート高を持つ */
  const viewportHeight = ref(typeof window === 'undefined' ? 0 : window.innerHeight)

  const maxHeight = computed(() => {
    const byViewport = Math.round(viewportHeight.value * COMPOSER_HEIGHT.MAX_VIEWPORT_RATIO)
    // ビューポートが取れない環境では絶対値だけで判断する
    return byViewport > COMPOSER_HEIGHT.MIN
      ? Math.min(COMPOSER_HEIGHT.MAX, byViewport)
      : COMPOSER_HEIGHT.MAX
  })

  const clamp = (height) =>
    Math.min(maxHeight.value, Math.max(COMPOSER_HEIGHT.MIN, Math.round(height)))

  /** 実際に適用する高さ。手動指定があればそれを優先する */
  const height = computed(() => clamp(manualHeight.value ?? autoHeight.value))

  /** style バインド用。`rows` 属性より後に効くのでフォールバックを壊さない */
  const heightStyle = computed(() => ({ height: `${height.value}px` }))

  /**
   * 本文の実際の高さを測って autoHeight に反映する。
   * height を一度 auto に戻してから scrollHeight を読む（縮む方向にも追従させるため）。
   */
  const measure = () => {
    const node = textareaRef.value
    if (!node) return

    const applied = node.style.height
    node.style.height = 'auto'
    const content = node.scrollHeight
    node.style.height = applied

    autoHeight.value = clamp(content)
  }

  // 本文が変わったら測り直す。DOM に値が反映された後に測る必要がある
  watch(value, () => nextTick(measure))

  // #region 幅・画面サイズの変化への追従
  // ペイン幅が変わると折り返し行数が変わるので測り直す。
  // 高さの変化で再帰的に発火しないよう、幅が変わったときだけ測る。
  let observer = null
  let lastWidth = 0

  const onWindowResize = () => {
    viewportHeight.value = window.innerHeight
    measure()
  }

  onMounted(() => {
    measure()
    window.addEventListener('resize', onWindowResize)

    if (typeof ResizeObserver === 'undefined' || !textareaRef.value) return

    lastWidth = textareaRef.value.clientWidth
    observer = new ResizeObserver(() => {
      const width = textareaRef.value?.clientWidth ?? 0
      if (width === lastWidth) return

      lastWidth = width
      measure()
    })
    observer.observe(textareaRef.value)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize)
    observer?.disconnect()
    observer = null
  })
  // #endregion

  return {
    textareaRef,
    manualHeight,
    height,
    heightStyle,
    minHeight: COMPOSER_HEIGHT.MIN,
    maxHeight,
    /** 定型文展開などで本文を差し替えた直後に呼ぶ（watch より先に見た目を合わせたいとき） */
    measure,
  }
}
