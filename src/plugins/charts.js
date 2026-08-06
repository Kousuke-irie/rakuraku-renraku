// P4-4: Chart.js のセットアップと、ダッシュボード共通の描画設定。
//
// ★`chart.js/auto` を import しないこと。全コントローラが入って肥大化する。
//   使う分だけ明示登録する。
//
// ★Legend は登録しない。単一系列のチャートに凡例は出さない方針で、
//   複数系列（担当者別SLA）は各セグメントに直接ラベルを描くため。
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
} from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

/**
 * 配色（monitoring.md §6「色の検証結果」）。
 *
 * dataviz の検証スクリプトで実測済み。**勝手に変えないこと。**
 * 対応ステータスのチップ色（#F5A623 等）は白背景で 2.03:1 しかなく、
 * 細い積み上げセグメントでは背景に溶けるため流用禁止。
 */
export const CHART_COLOR = Object.freeze({
  /** 単一色バー・推移。検証で全項目 PASS */
  PRIMARY: '#3B7FC4',
  /** 辞退（進行段階ではなく離脱） */
  EXIT: '#D03B3B',

  /**
   * 選考ステータスの4区分（SELECTION_PHASE）。
   * 検証済み：全項目 PASS（隣接 CVD ΔE 15.0 / 通常視 17.7）。
   *
   * ★「確定＝緑」にできない。バーの並び順で確定(内定)と離脱(辞退)が隣接するため、
   *   緑と赤を当てると P型・D型色覚で潰れる（実測 CVD ΔE 5.2）。
   *   代わりに紫を当てている。**この4色は勝手に変えないこと。**
   */
  PHASE_PRE: '#C98500',
  PHASE_IN_PROGRESS: '#3B7FC4',
  PHASE_SETTLED: '#4a3aa7',
  PHASE_EXITED: '#D03B3B',
  /** SLA 3段。CVD分離のみ WARN 7.0 → 直接ラベル＋2pxギャップで充足 */
  SLA_WITHIN: '#2F8F5B',
  SLA_OVER_24H: '#C98500',
  SLA_OVER_48H: '#D03B3B',
})

const INK = '#1d1d1d'
const INK_MUTE = '#696969'
const HAIRLINE = '#e6e6e6'

/** 目盛・グリッドは主張させない（データより濃くしない） */
const AXIS = Object.freeze({
  grid: { color: HAIRLINE, drawTicks: false },
  border: { display: false },
  ticks: { color: INK_MUTE, font: { size: 11 } },
})

const CATEGORY_AXIS = Object.freeze({
  grid: { display: false },
  border: { display: false },
  ticks: { color: INK, font: { size: 11 } },
})

/** 全チャート共通。凡例は出さず、ツールチップだけ付ける */
export const BASE_OPTIONS = Object.freeze({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 200 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: INK,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      padding: 8,
      displayColors: false,
    },
  },
})

/** 横棒（選考ステータス別・コンプラ内訳）。データ端だけ角丸 */
export function horizontalBarOptions(extra = {}) {
  return {
    ...BASE_OPTIONS,
    indexAxis: 'y',
    scales: {
      x: { ...AXIS, beginAtZero: true, ticks: { ...AXIS.ticks, precision: 0 } },
      y: CATEGORY_AXIS,
    },
    ...extra,
  }
}

/** 縦棒（推移） */
export function verticalBarOptions(extra = {}) {
  return {
    ...BASE_OPTIONS,
    scales: {
      x: CATEGORY_AXIS,
      y: { ...AXIS, beginAtZero: true, ticks: { ...AXIS.ticks, precision: 0 } },
    },
    ...extra,
  }
}

/**
 * 横100%積み上げ（担当者別SLA）。
 * セグメント間に2pxの白ギャップを入れるのが色覚多様性への二次エンコーディング。
 */
export function stackedBarOptions(extra = {}) {
  return {
    ...BASE_OPTIONS,
    indexAxis: 'y',
    scales: {
      x: { ...AXIS, stacked: true, beginAtZero: true, ticks: { ...AXIS.ticks, precision: 0 } },
      y: { ...CATEGORY_AXIS, stacked: true },
    },
    ...extra,
  }
}

/** バーの共通見た目。細めにして、データ端だけ角丸にする */
export const BAR_STYLE = Object.freeze({
  borderRadius: 4,
  borderSkipped: 'start',
  maxBarThickness: 22,
})

/** 積み上げ用。白ギャップでセグメントを分ける */
export const STACKED_BAR_STYLE = Object.freeze({
  borderRadius: 4,
  borderSkipped: false,
  maxBarThickness: 22,
  borderColor: '#ffffff',
  borderWidth: 2,
})
