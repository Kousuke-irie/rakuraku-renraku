// P4-7: 学生本人へのお知らせ。
//
// これまで通知は人事の監視イベントだけだった。学生側は「選考が進んだ」「FBが載った」を
// マイページ（S-09）を開き直すまで知れず、動きがあったことに気づけなかった。
//
// ★`alerts` テーブルは人事の監視イベントと共用する。**混ざらない保証は宛先ではなく
//   読者の対応表（shared/constants.js の ALERT_KIND_AUDIENCE）と、それを突き合わせる
//   services/alertView.js が担う。** ここは「学生向けの kind を、学生本人宛に作る」
//   という約束を守るだけでよい。
//
// ★多重通知を防ぐのは idx_alerts_student_unique（部分UNIQUE）だけ。
//   rule_code に選考ステップを入れ、INSERT OR IGNORE で弾く。
import {
  ALERT_KIND,
  ALERT_SEVERITY,
  SELECTION_FLOW_STEP_VALUES,
  SELECTION_STATUS,
} from '../../shared/constants.js';
import { buildStudentFlow, listSelectionSteps } from './selectionFlow.js';

const INSERT_SQL = `
  INSERT OR IGNORE INTO alerts
    (kind, severity, room_id, target_user_id, actor_user_id, trigger_message_id, rule_code, detail, created_at)
  VALUES
    (@kind, @severity, @roomId, @targetUserId, @actorUserId, NULL, @ruleCode, @detail, @createdAt)
`;

/**
 * 選考が「進んだ」と言えるか。
 *
 * 並びは SELECTION_FLOW_STEP_VALUES（＝選考の進行順）。
 * - 前に戻した場合は通知しない。人事の打ち間違いの訂正でお祝いが飛ぶのは避ける
 * - `declined`（辞退）はフロー上の段階ではないので常に通知しない。
 *   本人が辞退を申し出た結果の登録であり、本人に知らせる意味がない
 */
export function isSelectionAdvanced(previousStatus, nextStatus) {
  if (previousStatus === nextStatus) return false;
  if (nextStatus === SELECTION_STATUS.DECLINED) return false;
  // 辞退から復帰した場合は「進んだ」とみなす（前の位置が並びに無いため）
  if (previousStatus === SELECTION_STATUS.DECLINED) return true;

  const previousIndex = SELECTION_FLOW_STEP_VALUES.indexOf(previousStatus);
  const nextIndex = SELECTION_FLOW_STEP_VALUES.indexOf(nextStatus);
  if (nextIndex === -1) return false;

  return nextIndex > previousIndex;
}

/** 人事が設定した表示名（無ければ既定ラベル）。学生が見ている呼び名に合わせる */
function stepLabel(db, statusKey) {
  const step = listSelectionSteps(db).find((candidate) => candidate.statusKey === statusKey);
  return step?.label ?? statusKey;
}

function insertStudentAlert(db, { kind, roomId, studentUserId, actorUserId, ruleCode, detail, now }) {
  const result = db.prepare(INSERT_SQL).run({
    kind,
    // 学生へのお知らせは「情報」。監視の警告と同じ重さで扱わない
    severity: ALERT_SEVERITY.INFO,
    roomId,
    targetUserId: studentUserId,
    actorUserId,
    ruleCode,
    detail,
    createdAt: new Date(now).toISOString(),
  });

  // 既に通知済みなら changes === 0。配信しない
  if (result.changes === 0) return null;

  return { id: Number(result.lastInsertRowid), kind, targetUserId: studentUserId, roomId };
}

/**
 * 選考が次のステップへ進んだことを本人へ知らせる（P4-7）。
 *
 * 文面は**合否を断定しない**。「一次面接に合格しました」と書くと、
 * ステータスの付け替えが合否通知そのものになってしまう。
 * 正式な連絡は人事がチャットで行うものであり、ここはその予告に留める。
 *
 * @returns {object[]} 新規に作られた通知（配信対象）
 */
export function notifySelectionAdvanced(
  db,
  { roomId, studentUserId, actorUserId, previousStatus, nextStatus, now = Date.now() },
) {
  if (!roomId || !isSelectionAdvanced(previousStatus, nextStatus)) return [];

  const label = stepLabel(db, nextStatus);
  const created = insertStudentAlert(db, {
    kind: ALERT_KIND.STUDENT_SELECTION_ADVANCED,
    roomId,
    studentUserId,
    actorUserId,
    // ★冪等キー。到達したステップごとに1件
    ruleCode: nextStatus,
    detail: `選考が次のステップへ進みました。現在の段階は「${label}」です。`,
    now,
  });

  return created ? [created] : [];
}

/**
 * 本人に見える状態になったフィードバックを知らせる（P4-7）。
 *
 * ★「見える」の判定は `buildStudentFlow` に委ねる。マイページが実際に返している
 *   ものと同じ関数なので、**完了済みステップだけ**という約束が二重管理にならない。
 *   まだ進行中のステップに書かれたFBを通知すると、合否連絡より先に本人へ漏れる
 *   （selectionFlow.js の設計）。
 *
 * FBを先に書いて後からステップが完了した場合も、選考が進んだタイミングで
 * この関数を呼べば拾える。既に知らせたぶんは UNIQUE 制約が弾く。
 *
 * @returns {object[]} 新規に作られた通知（配信対象）
 */
export function notifyVisibleFeedbacks(
  db,
  { roomId, studentUserId, actorUserId = null, now = Date.now() },
) {
  if (!roomId) return [];

  const { steps } = buildStudentFlow(db, studentUserId);
  const created = [];

  for (const step of steps) {
    if (!step.feedback) continue;

    const alert = insertStudentAlert(db, {
      kind: ALERT_KIND.STUDENT_FEEDBACK_PUBLISHED,
      roomId,
      studentUserId,
      actorUserId,
      // ★冪等キー。ステップごとに1件。あとから書き換えても再通知はしない
      ruleCode: step.statusKey,
      detail: `「${step.label}」の選考フィードバックが公開されました。マイページからご確認ください。`,
      now,
    });

    if (alert) created.push(alert);
  }

  return created;
}
