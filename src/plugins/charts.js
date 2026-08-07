// P4-4: Chart.js のセットアップと、ダッシュボード共通の描画設定。
//
// ★`chart.js/auto` を import しないこと。全コントローラが入って肥大化する。
//   使う分だけ明示登録する。
//
// ★Legend は登録しない。単一系列のチャートに凡例は出さない方針で、
//   複数系列（担当者別SLA）は各セグメントに直接ラベルを描くため。
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(
  BarController,
  BarElement,
  // P4-8: 構成比のドーナツと、時間帯別の折れ線
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
)

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

  /**
   * 対応ステータス5分類のドーナツ（P4-8）。HANDLING_STATUS_VALUES と同じ並び。
   *
   * ★ドーナツは**最初と最後のセグメントも接する**ので、隣接判定は輪として見る。
   *   この並び（赤→橙→青→緑→紫→赤）で隣接する全ペアが検証を通っている
   *   （最悪 #C98500↔#D03B3B の CVD ΔE 10.2 / 通常視 16.9、巻き戻りの
   *   #4a3aa7↔#D03B3B は CVD 21.5 / 通常視 30.8）。**並べ替えないこと。**
   *
   * ★ただし赤（要返信）と緑（完了）は接していないだけで、全ペアで見ると
   *   CVD ΔE 5.2 と潰れる。**この2つは色だけでは区別できない前提で描く。**
   *   凡例に必ず件数と割合を添えること（ChartPanel の legend の value）。
   */
  HANDLING_NEEDS_REPLY: '#D03B3B',
  HANDLING_IN_PROGRESS: '#C98500',
  HANDLING_WAITING_STUDENT: '#3B7FC4',
  HANDLING_DONE: '#2F8F5B',
  HANDLING_ON_HOLD: '#4a3aa7',

  /**
   * 重大度3段（P4-8）。AI推奨度と返信状況のドーナツで共通に使う。
   * 「赤＝手を打つべき／橙＝様子見／青＝問題なし」を2つのグラフで揃える。
   *
   * ★SLA の3色（緑・橙・赤）は流用できない。3分類のドーナツは3ペアすべてが
   *   隣接するため、緑と赤が必ず接して CVD ΔE 5.2 で潰れる（実測）。
   *   緑を青に置き換えた組み合わせは全ペア PASS（最悪 CVD ΔE 10.2 / 通常視 16.9）。
   */
  SEVERITY_HIGH: '#D03B3B',
  SEVERITY_MID: '#C98500',
  SEVERITY_LOW: '#3B7FC4',

  /**
   * 時間帯別の2系列（P4-8）。全ペア PASS（CVD ΔE 24.0 / 通常視 28.2）。
   * 色に加えて線種（実線／破線）と点の形（丸／三角）でも区別する。
   */
  ACTOR_HR: '#3B7FC4',
  ACTOR_STUDENT: '#C98500',
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

// ---------------------------------------------------------------------------
// P4-8 個人ダッシュボード
// ---------------------------------------------------------------------------

/**
 * 構成比のドーナツ（対応ステータス・AI推奨度・返信状況）。
 *
 * ★円ではなくドーナツにする。中心を空けるぶん外周が細くなり、
 *   面積ではなく**弧の長さ**で読ませられる（面積比較は人の目が苦手）。
 * ★セグメント間の2px白ギャップは積み上げ棒と同じ二次エンコーディング。
 *
 * 件数と割合は canvas に描かず、凡例（HTML）に添える。
 * canvas 内の引き出し線は5分類だと必ず衝突するうえ、読み上げもできない。
 */
export function doughnutOptions(extra = {}) {
  return {
    ...BASE_OPTIONS,
    cutout: '58%',
    plugins: {
      ...BASE_OPTIONS.plugins,
      tooltip: {
        ...BASE_OPTIONS.plugins.tooltip,
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((sum, value) => sum + value, 0)
            const percent = total === 0 ? 0 : Math.round((context.parsed / total) * 100)

            return `${context.label}：${context.parsed}件（${percent}%）`
          },
        },
      },
    },
    ...extra,
  }
}

/** ドーナツの共通見た目。白ギャップでセグメントを分ける */
export const DOUGHNUT_STYLE = Object.freeze({
  borderColor: '#ffffff',
  borderWidth: 2,
  hoverOffset: 6,
})

/**
 * 折れ線（時間帯別の返信タイミング）。
 *
 * ★y軸は**構成比（%）**を前提にする。人事と学生でメッセージ総数が違うため、
 *   件数のまま重ねると「タイミングのずれ」ではなく「量の差」しか読めない。
 * ★軸は1本だけ。2系列を別スケールにしない（比較が成立しなくなる）。
 */
export function lineOptions(extra = {}) {
  return {
    ...BASE_OPTIONS,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: CATEGORY_AXIS,
      y: {
        ...AXIS,
        beginAtZero: true,
        ticks: { ...AXIS.ticks, callback: (value) => `${value}%` },
      },
    },
    plugins: {
      ...BASE_OPTIONS.plugins,
      tooltip: {
        ...BASE_OPTIONS.plugins.tooltip,
        // 2系列を並べて出すので、どちらの線かが分かるよう色マーカーを出す
        displayColors: true,
        callbacks: {
          label: (context) => `${context.dataset.label}：${context.parsed.y}%`,
        },
      },
    },
    ...extra,
  }
}

/**
 * 折れ線の共通見た目。
 * **色以外に線種と点の形でも区別する**（CLAUDE.md §6-13）。
 * 点は直径8px以上にして、線が重なる時間帯でも系列を追えるようにする。
 */
export const LINE_STYLE = Object.freeze({
  borderWidth: 2,
  // 時間帯は離散値なので補間で山を作らない（無い時刻の値をでっち上げないため）
  tension: 0,
  fill: false,
  pointRadius: 4,
  pointHoverRadius: 6,
  pointBorderColor: '#ffffff',
  pointBorderWidth: 2,
})
