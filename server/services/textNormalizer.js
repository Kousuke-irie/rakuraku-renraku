// P4-2b: 検知の前処理。表記ゆれと空白による回避をつぶす。
//
// 「本 籍はどちらですか」のように半角・全角の空白を挟むだけで部分一致を
// すり抜けられてしまうため、照合は**正規化した文字列**に対して行う。
//
// ただし人事に見せる該当箇所（matched）は**元の本文**から切り出したい。
// そのため正規化と同時に「正規化後の位置 → 元の位置」の対応表を作って返す。

/**
 * 照合対象から落とす文字。
 *  - 空白（半角・全角・タブ・改行）：回避に使われる
 *  - ゼロ幅文字：見えないので回避に使われる
 * 句読点や記号は落とさない。文の切れ目まで消すと、離れた語同士が
 * つながって誤検知するため。
 */
const DROPPED_CHAR = /[\s\u3000\u200B-\u200D\uFEFF]/u;

/** 半角カナの濁点・半濁点。直前の文字と1文字に合成される（ｼ + ﾞ → ジ） */
const HALFWIDTH_VOICED_MARK = /[ﾞﾟ]/u;

/**
 * 照合用に正規化する。
 *
 * 1. NFKC 正規化（全角英数→半角、半角カナ→全角カナ、互換文字の統一）
 * 2. 小文字化（ローマ字のキーワードを大文字小文字問わず拾う）
 * 3. 空白・ゼロ幅文字の除去
 *
 * ★位置は一貫して **UTF-16 コードユニット単位**で扱う。
 *   `RegExp.exec().index` も `String.indexOf` もコードユニット基準なので、
 *   ここをコードポイント単位にすると絵文字を含む本文で該当箇所がずれる。
 *
 * @param {string} body
 * @returns {{ text: string, map: number[] }}
 *   text = 正規化後の文字列 /
 *   map  = text のコードユニット i が、元の本文のどのコードユニットに対応するか
 */
export function normalizeForMatch(body) {
  let out = '';
  const map = [];

  // for...of はコードポイント単位で回るので、元の位置は別に数える
  let cursor = 0;
  const chars = Array.from(body);

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const next = chars[index + 1];

    // 「ｼ」+「ﾞ」は2文字まとめて NFKC しないと「ジ」に合成されない
    const composed = next && HALFWIDTH_VOICED_MARK.test(next) ? char + next : char;
    const normalized = composed.normalize('NFKC').toLowerCase();

    for (const outChar of normalized) {
      if (!DROPPED_CHAR.test(outChar)) {
        out += outChar;
        // NFKC で1文字が複数文字に割れることがある（㍑→リットル）。
        // 割れた分はすべて元の同じ位置に対応づける。
        for (let unit = 0; unit < outChar.length; unit += 1) map.push(cursor);
      }
    }

    cursor += composed.length;
    if (composed !== char) index += 1;
  }

  return { text: out, map };
}

/**
 * 正規化後の一致範囲を、元の本文の範囲へ戻す。
 *
 * @param {number[]} map normalizeForMatch が返した対応表
 * @param {number} start 正規化後の開始位置（コードユニット）
 * @param {number} length 正規化後の一致長（コードユニット）
 * @returns {{ start: number, end: number }} 元の本文でのコードユニット範囲（end は排他）
 */
export function toOriginalRange(map, start, length) {
  if (map.length === 0) return { start: 0, end: 0 };

  const safeStart = Math.min(Math.max(start, 0), map.length - 1);
  const safeLast = Math.min(start + Math.max(length, 1) - 1, map.length - 1);

  return { start: map[safeStart], end: map[safeLast] + 1 };
}
