// ワードマーク画像（logo-rakuraku.png）の「円マーク（オレンジの丸）」の位置を測る。
//
// ログイン → ホームの円形トランジション（CircleRevealOverlay）が、
// 「ログイン画面のロゴの円」から広げ、「ナビレールのロゴの円」へ収束するために使う。
//
// ★座標は必ず getBoundingClientRect() から実測する。
//   ロゴの表示サイズは画面幅（AuthLayout は min(360px, 100%)）やレールの開閉で変わるため、
//   px を直書きするとレスポンシブで中心がずれる。

/** 円マークを持つ <img> に付ける属性名。値は LOGO_MARK のいずれか */
const LOGO_MARK_ATTR = "data-logo-mark"

/** 円マークの置き場所。ログイン画面のブランド面と、ログイン後のナビレール */
export const LOGO_MARK = Object.freeze({
  AUTH: "auth",
  RAIL: "rail",
})

/**
 * 画像は 800x227 で、円マークは左端の 227x227 ちょうど。
 * 中心の横位置は画像幅に対して (227 / 2) / 800、縦位置は高さの中央。
 */
const MARK_CENTER_RATIO_X = 227 / 2 / 800

/**
 * 円マークを持つ <img> を探す。
 * @param {string} place LOGO_MARK のいずれか
 * @returns {HTMLElement|null} 見つからなければ null（アニメーションはスキップする）
 */
export function findLogoMark(place) {
  return document.querySelector(`[${LOGO_MARK_ATTR}="${place}"]`)
}

/**
 * 円マークの中心座標と半径（viewport 基準・px）。
 *
 * ナビレールでは画像が overflow:hidden の枠で右側を切られているが、
 * getBoundingClientRect() が返すのは切り取り前のレイアウト矩形なので、
 * ログイン画面と同じ比率計算がそのまま使える。
 *
 * @param {HTMLElement|null} el findLogoMark() の戻り値
 * @returns {{x: number, y: number, radius: number}|null} 未レイアウトなら null
 */
export function getLogoMarkCircle(el) {
  if (!el) return null

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null

  return {
    x: rect.left + rect.width * MARK_CENTER_RATIO_X,
    // 円マークは画像の高さいっぱいなので、縦中央＝円の中心・高さの半分＝半径
    y: rect.top + rect.height / 2,
    radius: rect.height / 2,
  }
}
