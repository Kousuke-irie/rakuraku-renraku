// P4-2: 検知結果を alerts に記録する。
//
// ★この記録がこの機能の本体である。
// 送信前ダイアログ（P4-3）はクライアント側にあり DevTools で無効化できるため、
// サーバ側で保存時に再検査して残さないと「監視」が成立しない（CLAUDE.md §6-6）。
import {
  ALERT_KIND,
  COMPLIANCE_DISCLAIMER,
} from '../../shared/constants.js';
import { checkCompliance, isCheckedRole } from './complianceChecker.js';

/** detail に付す送信経路の注記。ダッシュボード（P4-4）の「無視して送信」の集計元になる。 */
export const ACK_NOTE = Object.freeze({
  /** 警告ダイアログを見たうえで送信された */
  ACKNOWLEDGED: '警告を承知で送信',
  /** 送信前チェックを通っていない（socket 直叩き・チェックAPIの失敗など） */
  UNCHECKED: '送信前チェック未経由',
  /** チェックは通ったが、この項目はクライアント側で検知されていなかった */
  MISMATCHED: 'クライアント側で未検知',
});

const INSERT_SQL = `
  INSERT OR IGNORE INTO alerts
    (kind, severity, room_id, target_user_id, actor_user_id, trigger_message_id, rule_code, detail, created_at)
  VALUES
    (@kind, @severity, @roomId, NULL, @actorUserId, @messageId, @ruleCode, @detail, @createdAt)
`;

/**
 * 送信経路の注記を決める。
 * acknowledgedCodes が未指定（null / undefined）なら送信前チェックを経ていない。
 */
export function resolveAckNote(code, acknowledgedCodes) {
  if (!Array.isArray(acknowledgedCodes)) return ACK_NOTE.UNCHECKED;
  return acknowledgedCodes.includes(code) ? ACK_NOTE.ACKNOWLEDGED : ACK_NOTE.MISMATCHED;
}

/**
 * 画面に出す短文を組み立てる。
 * **本文全体を入れない。** 該当キーワードの周辺だけを載せる（CLAUDE.md §6-8）。
 */
export function buildDetail(result, ackNote) {
  return `${result.message}｜該当：${result.matched}｜${ackNote}`;
}

/**
 * 人事の発言を検査し、該当があれば alerts に記録する。
 *
 * 学生の発言は検査しない。該当が無ければ何もしない。
 * 同一メッセージ×同一ルールの重複は idx_alerts_compliance_unique が弾くので、
 * 再送・リトライで二重に積まれることはない。
 *
 * 呼び出し側の想定は insertMessage（REST/socket の共通経路）。
 *
 * @param {object} params
 * @param {string[]|null} params.acknowledgedCodes
 *   送信前チェック（P4-3）で人事が承知したルールコード。未経由なら null。
 * @returns {object[]} 記録した検知結果（呼び出し側のログ用ではなく、テスト・API応答用）
 */
export function recordComplianceAlerts(
  db,
  { roomId, messageId, actorUserId, senderRole, body, acknowledgedCodes = null },
) {
  if (!isCheckedRole(senderRole)) return [];

  const results = checkCompliance(db, body);
  if (results.length === 0) return [];

  const createdAt = new Date().toISOString();
  const insert = db.prepare(INSERT_SQL);

  const run = db.transaction(() => {
    for (const result of results) {
      insert.run({
        kind: ALERT_KIND.COMPLIANCE,
        severity: result.severity,
        roomId,
        actorUserId,
        messageId,
        ruleCode: result.code,
        detail: buildDetail(result, resolveAckNote(result.code, acknowledgedCodes)),
        createdAt,
      });
    }
  });

  run();
  return results;
}

export { COMPLIANCE_DISCLAIMER };
