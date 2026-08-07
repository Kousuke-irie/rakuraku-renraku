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

/**
 * その学生に見せるステップ。
 *
 * 会社の設定（is_enabled）は**標準フロー**であって、個々の学生の実態はそれより優先される。
 * 有効なステップに加えて、次の2つは無効でも図に出す。
 *
 *   1. その学生の現在地 … 出さないと現在地のノードが図から消え、「山」の頂点が
 *      決まらないので線がまっすぐになる。学生には自分の段階が伝わらない
 *   2. FB が届いているステップ … 出さないと人事が書いたFBが黙って学生に届かない
 *
 * どちらも「人事があとからフロー設定を変えた」ときに起きる。設定を変えただけで
 * 進行中の学生の画面が壊れる、という状態を作らないための救済。
 *
 * @param {string|null} selectionStatus students.selection_status
 * @param {Map<string, object>} feedbacks findFeedbacksByStudent の結果
 */
function listVisibleSteps(db, { selectionStatus, feedbacks }) {
  return listSelectionSteps(db).filter(
    (step) =>
      step.isEnabled || step.statusKey === selectionStatus || feedbacks.has(step.statusKey)
  );
}

/**
 * ダッシュボードの「選考ステータス別」グラフに出す段階と、その並び（P4-8）。
 * **会社の選考フロー設定（`selection_steps`）に従う。**
 * 使っていない段階（例：四次・五次面接）を出さないため、また人事が付けた
 * 表示名（例：三次面接→「最終面接」）をグラフにも反映するため。
 *
 * ★無効な段階でも、そこに学生が**実在するなら出す**。
 *   `listVisibleSteps()` が学生の現在地を必ず含めるのと同じ理由で、
 *   「人事があとからフロー設定を変えただけで進行中の学生が消える」状態を作らない。
 *   消すとグラフの合計が担当学生数と合わなくなり、数字が信用されなくなる。
 *   出したぶんは `isEnabled: false` を添えて、標準フロー外だと分かるようにする。
 *
 * ★辞退はフロー上の一段階ではない（`selection_steps` にも無い）が、
 *   離脱の実数なので必ず最後に置く。
 *
 * @param {(statusKey: string) => number} countOf その段階にいる学生数
 */
export function listDashboardSelectionSteps(db, countOf) {
  const steps = listSelectionSteps(db)
    .filter((step) => step.isEnabled || countOf(step.statusKey) > 0)
    .map((step) => ({
      statusKey: step.statusKey,
      label: step.label,
      isEnabled: step.isEnabled,
    }));

  return [
    ...steps,
    {
      statusKey: SELECTION_STATUS.DECLINED,
      label: SELECTION_STATUS_META[SELECTION_STATUS.DECLINED].label,
      isEnabled: true,
    },
  ];
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
 * 並びの中で、学生がいまどこにいるかを判定する（business-logic.md §8）。
 *
 * 現在ステータスより前 → done ／ 同じ → current ／ 後ろ → upcoming。
 *
 * 現在地が並びに含まれていない場合は、`SELECTION_FLOW_STEP_VALUES` の全体順で比べ、
 * **その手前までを完了扱いにする**。進捗が全部 upcoming になって「何も進んでいない」
 * ように見えるのを防ぐため。
 *
 * ★`listVisibleSteps()` が現在地を必ず含めるようになったので、この分岐に入るのは
 *   選考ステータスが未設定・辞退のときだけ。それでも安全網として残す
 *   （この関数は並びを渡されるだけで、呼び出し側の都合を知らないため）。
 *
 * @param {string} selectionStatus students.selection_status
 * @param {{statusKey: string}[]} steps 学生に見せるステップ（sortOrder 昇順）
 * @returns {string[]} steps と同じ並びの FLOW_STEP_STATE
 */
export function resolveStepStates(selectionStatus, steps) {
  const currentIndex = steps.findIndex((step) => step.statusKey === selectionStatus);

  if (currentIndex !== -1) {
    return steps.map((_step, index) => {
      if (index < currentIndex) return FLOW_STEP_STATE.DONE;
      if (index === currentIndex) return FLOW_STEP_STATE.CURRENT;
      return FLOW_STEP_STATE.UPCOMING;
    });
  }

  // 並びに現在地が無い場合は、全体の並び（SELECTION_FLOW_STEP_VALUES）での位置で比べる
  const absoluteCurrent = SELECTION_FLOW_STEP_VALUES.indexOf(selectionStatus);
  if (absoluteCurrent === -1) return steps.map(() => FLOW_STEP_STATE.UPCOMING);

  return steps.map((step) =>
    SELECTION_FLOW_STEP_VALUES.indexOf(step.statusKey) < absoluteCurrent
      ? FLOW_STEP_STATE.DONE
      : FLOW_STEP_STATE.UPCOMING
  );
}

/**
 * その状態のステップに書いたFBを、学生本人に見せてよいか（business-logic.md §8）。
 *
 * ★可視範囲の判定はこの関数だけに置く。学生の画面と人事の画面で同じ答えを出すため。
 *   人事側で「学生に見えているか」を別途計算すると、必ずどこかでズレて
 *   「非公開」と表示されているFBが本人に見えている、という事故になる。
 */
export function isFeedbackVisibleToStudent(state) {
  return state === FLOW_STEP_STATE.DONE;
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

  // ★どのステップを出すかの判定に使うので、FB はステップの絞り込みより先に引く
  const feedbacks = findFeedbacksByStudent(db, studentUserId);
  const visibleSteps = listVisibleSteps(db, { selectionStatus, feedbacks });

  // 辞退はフロー上の一段階ではないので、線の上には現在地を置かない
  const states = isDeclined
    ? visibleSteps.map(() => FLOW_STEP_STATE.UPCOMING)
    : resolveStepStates(selectionStatus, visibleSteps);

  // 本人のメモ（S-10）。FB と違い完了判定で絞らない（本人が書いたものを本人に返すだけ）
  const notes = findNotesByStudent(db, studentUserId);

  const steps = visibleSteps.map((step, index) => {
    const state = states[index];
    // ★見せてよいステップのFBだけ載せる（進行中・未到達は載せない）
    const feedback = isFeedbackVisibleToStudent(state)
      ? (feedbacks.get(step.statusKey) ?? null)
      : null;

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

/** 人事が見るFB（書いた人の名前つき）を status_key をキーにして引く */
function findFeedbacksForHr(db, studentUserId) {
  const rows = db
    .prepare(
      `SELECT f.status_key AS statusKey, f.body, f.updated_at AS updatedAt,
              u.display_name AS authorName
       FROM selection_feedbacks f
       JOIN users u ON u.id = f.author_id
       WHERE f.student_user_id = ?`
    )
    .all(studentUserId);

  return new Map(rows.map((row) => [row.statusKey, row]));
}

/**
 * 人事のプロフィールパネル（P2-11）が必要とするものを1回で返す。
 *
 * ★「本人に見えているか」はサーバが返す。**クライアントで再計算させない。**
 *   人事側で独自に判定すると、現在地が無効ステップにある学生などで学生側とズレて、
 *   「本人には非公開」と表示されているFBが実際は本人に見えている、という事故になる。
 *
 * 学生側（buildStudentFlow）と同じ listVisibleSteps / resolveStepStates を通すので、
 * 出てくる並びと状態は必ず一致する。
 *
 * @param {number} studentUserId 対象の学生。認可は呼び出し側（routes/students.js）が済ませる
 */
export function buildHrFeedbackView(db, studentUserId) {
  const student = db
    .prepare('SELECT selection_status AS selectionStatus FROM students WHERE user_id = ?')
    .get(studentUserId);

  const selectionStatus = student?.selectionStatus ?? null;
  const isDeclined = selectionStatus === SELECTION_STATUS.DECLINED;

  const feedbacks = findFeedbacksForHr(db, studentUserId);
  const visibleSteps = listVisibleSteps(db, { selectionStatus, feedbacks });

  const states = isDeclined
    ? visibleSteps.map(() => FLOW_STEP_STATE.UPCOMING)
    : resolveStepStates(selectionStatus, visibleSteps);

  const steps = visibleSteps.map((step, index) => {
    const state = states[index];

    return {
      statusKey: step.statusKey,
      label: step.label,
      state,
      isVisibleToStudent: isFeedbackVisibleToStudent(state),
      /** 会社の標準フローから外れているステップ。人事に注記を出すために返す */
      isEnabled: step.isEnabled,
      feedback: feedbacks.get(step.statusKey) ?? null,
    };
  });

  return { steps, selectionStatus, isDeclined };
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
