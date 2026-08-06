// P4-2: 人事の発言から就職差別・オワハラ表現を検知する。
//
// 辞書ベースが本体で、外部APIには依存しない（monitoring.md §4）。
// 送信前チェック（P4-3）が同期で呼ぶので、DB1回＋文字列走査だけで完結させること。
//
// tagClassifier との違い：
//  - 検査対象は hr / admin の発言のみ（学生の発言は検査しない）
//  - 最初のマッチで確定しない。1通に複数の問題が混ざりうるので全件返す
import {
  ALERT_SEVERITY_ORDER,
  COMPLIANCE_CATEGORY,
  ROLE,
} from '../../shared/constants.js';

/** detail / matched に載せる該当箇所の前後文字数（本文全体を記録しないため） */
const MATCH_CONTEXT_CHARS = 20;

let cachedRules = null;

function loadRules(db) {
  if (cachedRules) return cachedRules;

  cachedRules = db
    .prepare(
      `SELECT code, category, keyword, exclude_keyword AS excludeKeyword, severity, message
       FROM compliance_rules
       ORDER BY priority ASC, id ASC`,
    )
    .all();

  return cachedRules;
}

/** テストや辞書更新後にキャッシュを破棄する。 */
export function clearComplianceRuleCache() {
  cachedRules = null;
}

/**
 * exclude_keyword はカンマ区切りの複数語。**いずれか1つでも本文にあれば検知しない。**
 * 空文字や余分な空白は無視する。
 */
export function isExcluded(body, excludeKeyword) {
  if (!excludeKeyword) return false;

  return excludeKeyword
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean)
    .some((word) => body.includes(word));
}

/** 検査対象のロールか。学生の発言は検査しない。 */
export function isCheckedRole(role) {
  return role === ROLE.HR || role === ROLE.ADMIN;
}

/**
 * 該当キーワードの周辺だけを切り出す。
 * 本文をそのまま alerts.detail に保存しないための措置（CLAUDE.md §6-8）。
 */
export function extractMatchContext(body, keyword) {
  const chars = Array.from(body);
  const index = body.indexOf(keyword);
  if (index < 0) return '';

  // indexOf はコードユニット基準なので、サロゲートペアを含む本文でも
  // 崩れないように配列側の位置へ変換してから切り出す。
  const startUnits = body.slice(0, index);
  const start = Array.from(startUnits).length;
  const end = start + Array.from(keyword).length;

  const from = Math.max(0, start - MATCH_CONTEXT_CHARS);
  const to = Math.min(chars.length, end + MATCH_CONTEXT_CHARS);

  return (
    (from > 0 ? '…' : '') + chars.slice(from, to).join('') + (to < chars.length ? '…' : '')
  );
}

/**
 * 本文を検査し、該当したルールを重い順（block → warn → info）で返す。
 *
 * 同一 code は1件に畳む（同じ観点で2回警告しても人事の判断材料は増えない）。
 * 一致が無ければ空配列を返す。
 *
 * @returns {{code:string, category:string, severity:string, message:string, keyword:string, matched:string}[]}
 */
export function checkCompliance(db, body) {
  if (typeof body !== 'string' || body.trim() === '') return [];

  const found = new Map();

  for (const rule of loadRules(db)) {
    if (found.has(rule.code)) continue;
    if (!body.includes(rule.keyword)) continue;
    // 「本籍地はお伺いしません」のような、正しい文が誤検知されるのを防ぐ
    if (isExcluded(body, rule.excludeKeyword)) continue;

    found.set(rule.code, {
      code: rule.code,
      category: rule.category,
      severity: rule.severity,
      message: rule.message,
      keyword: rule.keyword,
      matched: extractMatchContext(body, rule.keyword),
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

/** 表示・ソート用に最も重い severity を返す。該当なしは null。 */
export function highestSeverity(results) {
  if (results.length === 0) return null;
  return results[0].severity;
}

export { COMPLIANCE_CATEGORY };
