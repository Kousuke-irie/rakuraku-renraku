import { DEFAULT_TOPIC_TAG } from '../../shared/constants.js';

let cachedRules = null;

function loadRules(db) {
  if (cachedRules) return cachedRules;

  cachedRules = db
    .prepare(
      `SELECT tag, keyword
       FROM tag_rules
       ORDER BY priority ASC, id ASC`,
    )
    .all();

  return cachedRules;
}

/**
 * 学生メッセージの用件タグを、DBの辞書を優先度順に部分一致して判定する。
 * 辞書は初回利用時に読み込み、以降はプロセス内で再利用する。
 */
export function classifyTopicTag(db, body) {
  const matched = loadRules(db).find(({ keyword }) => body.includes(keyword));
  return matched?.tag ?? DEFAULT_TOPIC_TAG;
}

/** テストや辞書更新後にキャッシュを破棄する。 */
export function clearTagRuleCache() {
  cachedRules = null;
}
