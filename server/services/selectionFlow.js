// 選考フローの設定と進捗（P2-11 / S-09・business-logic.md §8）
//
// 設計の要点：
//  - ステップの識別子は shared/constants.js の SELECTION_STATUS が正。
//    このサービスが持つのは「どれを使うか」「どう見せるか」の設定だけ。
//  - 学生の現在位置は students.selection_status（P1-3 が維持している）。
//    進捗はそこから毎回導出する。学生ごとに進捗を保存しない（二重管理を避ける）。
//
// ★セキュリティ：学生に返してよいフィードバックは**完了済みステップのぶんだけ**。
//   進行中・未到達のFBは合否連絡より先に本人へ漏れるため、この層で落とす。

import {
  FLOW_STEP_STATE,
  SELECTION_FLOW_STEP_VALUES,
  SELECTION_STATUS,
  SELECTION_STATUS_META,
} from '../../shared/constants.js';
import { findNotesByStudent, findOverallNote } from './studentNotes.js';

const STEP_SELECT_SQL = `
  SELECT status_key AS statusKey, is_enabled AS isEnabled, sort_order AS sortOrder,
         label, description, points
  FROM selection_steps
`;

/**
 * 設定が1件も無いときの既定値。
 * migrate だけして seed していない状態でも学生の画面が空にならないようにする。
 * 面接は 1〜3 次までを既定で有効にし、4〜5 次は使わない（多くの採用フローに寄せた初期値）。
 */
const DEFAULT_DISABLED_STEPS = new Set([
  SELECTION_STATUS.INTERVIEW_4,
  SELECTION_STATUS.INTERVIEW_5,
]);

function buildDefaultSteps() {
  return SELECTION_FLOW_STEP_VALUES.map((statusKey, index) => ({
    statusKey,
    isEnabled: DEFAULT_DISABLED_STEPS.has(statusKey) ? 0 : 1,
    sortOrder: index,
    label: null,
    description: null,
    points: null,
  }));
}

/** 表示名。人事が上書きしていなければ SELECTION_STATUS_META のラベルを使う */
function resolveLabel(step) {
  return step.label || SELECTION_STATUS_META[step.statusKey].label;
}

/**
 * 設定の全ステップ（無効なものも含む）。人事の設定画面用。
 * 並びは sort_order。DB が空なら既定値を返す。
 */
export function listSelectionSteps(db) {
  const rows = db.prepare(`${STEP_SELECT_SQL} ORDER BY sort_order ASC`).all();
  const steps = rows.length > 0 ? rows : buildDefaultSteps();

  return steps.map((step) => ({
    ...step,
    isEnabled: Boolean(step.isEnabled),
    label: resolveLabel(step),
    /** 上書きされていない既定ラベル。設定画面で placeholder に使う */
    defaultLabel: SELECTION_STATUS_META[step.statusKey].label,
  }));
}

/** 学生に見せるステップ（有効なものだけ） */
function listEnabledSteps(db) {
  return listSelectionSteps(db).filter((step) => step.isEnabled);
}

/**
 * 設定の一括保存（人事のみ）。全ステップを受け取る全置換。
 * 部分更新にすると「説明を空にする」が表現できないため。
 *
 * @param {{statusKey: string, isEnabled: boolean, sortOrder: number,
 *          label: string|null, description: string|null, points: string|null}[]} steps
 */
export function saveSelectionSteps(db, steps) {
  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO selection_steps (status_key, is_enabled, sort_order, label, description, points, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(status_key) DO UPDATE SET
       is_enabled = excluded.is_enabled,
       sort_order = excluded.sort_order,
       label = excluded.label,
       description = excluded.description,
       points = excluded.points,
       updated_at = excluded.updated_at`
  );

  db.transaction(() => {
    for (const step of steps) {
      upsert.run(
        step.statusKey,
        step.isEnabled ? 1 : 0,
        step.sortOrder,
        step.label,
        step.description,
        step.points,
        now
      );
    }
  })();

  return listSelectionSteps(db);
}

/**
 * 有効ステップの並びの中で、学生がいまどこにいるかを判定する（business-logic.md §8）。
 *
 * 現在ステータスより前 → done ／ 同じ → current ／ 後ろ → upcoming。
 *
 * 現在ステータスが「無効化されたステップ」を指している場合（例：三次面接を使わない設定に
 * 変えたが、その段階の学生が残っている）は、**その手前までを完了扱いにする**。
 * 進捗が全部 upcoming になって「何も進んでいない」ように見えるのを防ぐため。
 *
 * @param {string} selectionStatus students.selection_status
 * @param {{statusKey: string}[]} enabledSteps 有効ステップ（sortOrder 昇順）
 * @returns {string[]} enabledSteps と同じ並びの FLOW_STEP_STATE
 */
export function resolveStepStates(selectionStatus, enabledSteps) {
  const currentIndex = enabledSteps.findIndex((step) => step.statusKey === selectionStatus);

  if (currentIndex !== -1) {
    return enabledSteps.map((_step, index) => {
      if (index < currentIndex) return FLOW_STEP_STATE.DONE;
      if (index === currentIndex) return FLOW_STEP_STATE.CURRENT;
      return FLOW_STEP_STATE.UPCOMING;
    });
  }

  // 無効ステップにいる場合は、全体の並び（SELECTION_FLOW_STEP_VALUES）での位置で比べる
  const absoluteCurrent = SELECTION_FLOW_STEP_VALUES.indexOf(selectionStatus);
  if (absoluteCurrent === -1) return enabledSteps.map(() => FLOW_STEP_STATE.UPCOMING);

  return enabledSteps.map((step) =>
    SELECTION_FLOW_STEP_VALUES.indexOf(step.statusKey) < absoluteCurrent
      ? FLOW_STEP_STATE.DONE
      : FLOW_STEP_STATE.UPCOMING
  );
}

/** 学生本人のフィードバックを status_key をキーにして引く */
function findFeedbacksByStudent(db, studentUserId) {
  const rows = db
    .prepare(
      `SELECT status_key AS statusKey, body, updated_at AS updatedAt
       FROM selection_feedbacks
       WHERE student_user_id = ?`
    )
    .all(studentUserId);

  return new Map(rows.map((row) => [row.statusKey, row]));
}

/**
 * 学生のマイページ（S-09）が必要とするものを1回で返す。
 * ステップ設定・自分の現在位置・見せてよいFB・本人のメモ（S-10）をまとめ、
 * 画面側の往復を1回にする。
 *
 * @param {number} studentUserId 認証済みの本人。クライアントから受け取らないこと
 */
export function buildStudentFlow(db, studentUserId) {
  const student = db
    .prepare('SELECT selection_status AS selectionStatus FROM students WHERE user_id = ?')
    .get(studentUserId);

  const selectionStatus = student?.selectionStatus ?? null;
  const isDeclined = selectionStatus === SELECTION_STATUS.DECLINED;

  const enabledSteps = listEnabledSteps(db);
  // 辞退はフロー上の一段階ではないので、線の上には現在地を置かない
  const states = isDeclined
    ? enabledSteps.map(() => FLOW_STEP_STATE.UPCOMING)
    : resolveStepStates(selectionStatus, enabledSteps);

  const feedbacks = findFeedbacksByStudent(db, studentUserId);
  // 本人のメモ（S-10）。FB と違い完了判定で絞らない（本人が書いたものを本人に返すだけ）
  const notes = findNotesByStudent(db, studentUserId);

  const steps = enabledSteps.map((step, index) => {
    const state = states[index];
    // ★完了済みのステップだけ FB を載せる（進行中・未到達は載せない）
    const feedback = state === FLOW_STEP_STATE.DONE ? (feedbacks.get(step.statusKey) ?? null) : null;

    return {
      statusKey: step.statusKey,
      label: step.label,
      description: step.description,
      points: step.points,
      state,
      feedback: feedback ? { body: feedback.body, updatedAt: feedback.updatedAt } : null,
      note: notes.get(step.statusKey) ?? null,
    };
  });

  return { steps, selectionStatus, isDeclined, overallNote: findOverallNote(db, studentUserId) };
}

/** 人事が見るフィードバック一覧（全ステップぶん。完了判定で絞らない） */
export function listFeedbacksForHr(db, studentUserId) {
  return db
    .prepare(
      `SELECT f.status_key AS statusKey, f.body, f.updated_at AS updatedAt,
              u.display_name AS authorName
       FROM selection_feedbacks f
       JOIN users u ON u.id = f.author_id
       WHERE f.student_user_id = ?`
    )
    .all(studentUserId);
}

/**
 * フィードバックの保存（人事のみ）。学生×ステップで1件なので UPSERT。
 * 空文字を渡されたら削除する（「書いたものを取り消す」を表現するため）。
 */
export function saveFeedback(db, { studentUserId, statusKey, body, authorId }) {
  if (!body) {
    db.prepare('DELETE FROM selection_feedbacks WHERE student_user_id = ? AND status_key = ?').run(
      studentUserId,
      statusKey
    );
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO selection_feedbacks (student_user_id, status_key, body, author_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_user_id, status_key) DO UPDATE SET
       body = excluded.body,
       author_id = excluded.author_id,
       updated_at = excluded.updated_at`
  ).run(studentUserId, statusKey, body, authorId, now, now);

  return db
    .prepare(
      `SELECT status_key AS statusKey, body, updated_at AS updatedAt
       FROM selection_feedbacks WHERE student_user_id = ? AND status_key = ?`
    )
    .get(studentUserId, statusKey);
}
