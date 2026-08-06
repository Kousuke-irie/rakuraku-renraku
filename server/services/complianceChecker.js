// P4-2: 人事の発言から就職差別・オワハラ表現を検知する（辞書ベース）。
//
// 外部APIには依存しない。送信前チェック（P4-3）が同期で呼ぶので、
// DB1回＋文字列走査だけで完結させること。LLM 判定は complianceAi.js が別に担う。
//
// tagClassifier との違い：
//  - 検査対象は hr / admin の発言のみ（学生の発言は検査しない）
//  - 最初のマッチで確定しない。1通に複数の問題が混ざりうるので全件返す
//
// P4-2b で以下を変えた：
//  - keyword / exclude_keyword を**正規表現**として扱う（表記ゆれ対策）
//  - 照合は**正規化した本文**に対して行う（空白挿入による回避対策）
import {
  ALERT_SEVERITY_ORDER,
  COMPLIANCE_CATEGORY,
  COMPLIANCE_SOURCE,
  ROLE,
} from '../../shared/constants.js';
import { normalizeForMatch, toOriginalRange } from './textNormalizer.js';

/** matched に載せる該当箇所の前後文字数（本文全体を記録しないため） */
const MATCH_CONTEXT_CHARS = 20;

let cachedRules = null;

/**
 * 辞書のパターンを正規表現に落とす。
 *
 * 辞書は正規化後の文字列に当てるので、パターン側も同じ正規化をかけてから
 * コンパイルする（辞書に全角が混ざっていても動くように）。
 * 不正な正規表現は**リテラルとして**扱う。辞書の1行のtypoで検査全体を
 * 落とさないため。
 */
function compilePattern(pattern) {
  const { text } = normalizeForMatch(pattern);
  if (!text) return null;

  try {
    return new RegExp(text, 'u');
  } catch {
    return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u');
  }
}

function loadRules(db) {
  if (cachedRules) return cachedRules;

  cachedRules = db
    .prepare(
      `SELECT code, category, keyword, exclude_keyword AS excludeKeyword, severity, message
       FROM compliance_rules
       ORDER BY priority ASC, id ASC`,
    )
    .all()
    .map((rule) => ({
      ...rule,
      // 起動後は同じ辞書を何度も使うので、正規表現は1回だけ組み立てる
      pattern: compilePattern(rule.keyword),
      excludePatterns: (rule.excludeKeyword ?? '')
        .split(',')
        .map((word) => word.trim())
        .filter(Boolean)
        .map(compilePattern)
        .filter(Boolean),
    }))
    .filter((rule) => rule.pattern);

  return cachedRules;
}

/** テストや辞書更新後にキャッシュを破棄する。 */
export function clearComplianceRuleCache() {
  cachedRules = null;
}

/** 検査対象のロールか。学生の発言は検査しない。 */
export function isCheckedRole(role) {
  return role === ROLE.HR || role === ROLE.ADMIN;
}

/**
 * 除外パターンのいずれかが正規化本文にあれば、そのルールは検知しない。
 * 「本籍地はお伺いしません」のような正しい文を block にしないための仕組み。
 */
export function isExcluded(normalizedText, excludePatterns) {
  return excludePatterns.some((pattern) => pattern.test(normalizedText));
}

/** サロゲートペアの途中で切らないよう境界を外側へ寄せる */
function safeBoundary(body, index) {
  if (index <= 0) return 0;
  if (index >= body.length) return body.length;
  // 後続サロゲートの手前なら1つ戻して、ペアを割らない
  const code = body.charCodeAt(index);
  return code >= 0xdc00 && code <= 0xdfff ? index - 1 : index;
}

/**
 * 元の本文から該当箇所の前後を切り出す。
 * **本文全体を alerts に残さないための措置**（CLAUDE.md §6-8）。
 *
 * start / end は normalizeForMatch と同じ UTF-16 コードユニット単位。
 */
export function extractContextAt(body, start, end) {
  const from = safeBoundary(body, Math.max(0, start - MATCH_CONTEXT_CHARS));
  const to = safeBoundary(body, Math.min(body.length, end + MATCH_CONTEXT_CHARS));

  return (
    (from > 0 ? '…' : '') + body.slice(from, to) + (to < body.length ? '…' : '')
  );
}

/**
 * 本文を検査し、該当したルールを重い順（block → warn → info）で返す。
 *
 * 同一 code は1件に畳む（同じ観点で2回警告しても人事の判断材料は増えない）。
 * 一致が無ければ空配列を返す。
 *
 * @returns {{code, category, severity, message, source, matched}[]}
 */
export function checkCompliance(db, body) {
  if (typeof body !== 'string' || body.trim() === '') return [];

  const { text, map } = normalizeForMatch(body);
  if (!text) return [];

  const found = new Map();

  for (const rule of loadRules(db)) {
    if (found.has(rule.code)) continue;

    const hit = rule.pattern.exec(text);
    if (!hit) continue;
    if (isExcluded(text, rule.excludePatterns)) continue;

    const range = toOriginalRange(map, hit.index, hit[0].length);

    found.set(rule.code, {
      code: rule.code,
      category: rule.category,
      severity: rule.severity,
      message: rule.message,
      source: COMPLIANCE_SOURCE.DICTIONARY,
      matched: extractContextAt(body, range.start, range.end),
    });
  }

  return [...found.values()].sort(
    (a, b) => ALERT_SEVERITY_ORDER[a.severity] - ALERT_SEVERITY_ORDER[b.severity],
  );
}

/** 検知結果のうち、送信前に止めるべきものがあるか（P4-3 のダイアログ判定）。 */
export function hasBlocking(results) {
  return results.some((result) => ALERT_SEVERITY_ORDER[result.severity] === 0);
}

export { COMPLIANCE_CATEGORY };
