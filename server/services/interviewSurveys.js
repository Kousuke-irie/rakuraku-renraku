// 面接アンケート（S-11）。学生が面接ステップごとに★5段階＋自由記述で答え、
// 人事は「面接官別」に読む。
//
// ★このサービスの最重要責務は匿名化。
//   学生カードには「回答内容は選考の合否には一切影響しません」と書いて集めている。
//   人事が回答者を特定できると分かった時点で学生は忖度して書き、この機能の価値は
//   消える。**人事向けの戻り値に student_user_id・氏名・ルームIDを載せないこと。**
//   student_user_id を持つのは「1学生×1ステップで1回だけ」を UNIQUE で担保するため
//   だけで、読み出しには使わない。student_notes（S-10）と同じ思想。
//
// ★回答は1回きりで上書きしない。学生カードが「ご回答ありがとうございました」で
//   終端する既存UIに合わせる（schema.sql に updated_at が無いのはそのため）。

import {
  FLOW_STEP_STATE,
  INTERVIEW_SURVEY_COMMENT_MAX_LENGTH,
  INTERVIEW_SURVEY_MIN_SAMPLE,
  INTERVIEW_SURVEY_RATING_MAX,
  INTERVIEW_SURVEY_RATING_MIN,
  INTERVIEW_SURVEY_SCOPE_ALL,
  INTERVIEW_SURVEY_STATUS_KEYS,
  INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_ID,
  INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_LABEL,
  SCHEDULE_REQUEST_STATUS,
  SELECTION_STATUS,
  SELECTION_STATUS_META,
} from '../../shared/constants.js';
import {
  buildStudentFlow,
  listSelectionSteps,
  resolveStepStates,
} from './selectionFlow.js';

/** 平均は小数第1位まで。バーの長さで比べる用途にこれ以上の桁は要らない */
function roundAverage(total, count) {
  if (count === 0) return null;
  return Math.round((total / count) * 10) / 10;
}

/**
 * その学生が既に回答済みのステップ。
 * マイページのカードを「お礼メッセージ」に切り替えるために使う。
 *
 * @returns {Set<string>} status_key の集合
 */
export function findAnsweredStatusKeys(db, studentUserId) {
  const rows = db
    .prepare('SELECT status_key AS statusKey FROM interview_surveys WHERE student_user_id = ?')
    .all(studentUserId);

  return new Set(rows.map((row) => row.statusKey));
}

/**
 * そのステップに学生が回答してよいか（＝完了済みの面接ステップか）。
 *
 * ★判定を selectionFlow.buildStudentFlow に通すこと。
 *   「完了済みか」の答えを2箇所で計算すると必ずズレる。学生の画面にカードが
 *   出ていないステップへ POST できてしまう、あるいはその逆が起きる。
 */
function findAnswerableStep(db, studentUserId, statusKey) {
  if (!INTERVIEW_SURVEY_STATUS_KEYS.includes(statusKey)) return null;

  const { steps, isDeclined } = buildStudentFlow(db, studentUserId);
  if (isDeclined) return null;

  const step = steps.find((item) => item.statusKey === statusKey);
  return step && step.state === FLOW_STEP_STATE.DONE ? step : null;
}

/**
 * 回答時点の面接官を特定する。
 *
 * 予約が確定した日程依頼から引く。`selection_stage`（学生に見せる自由入力の表示名）
 * ではなく `selection_status_key` で突き合わせる — 表示名は人事が書き換えられるので
 * 「2次」「二次面接（役員）」のような値になり、ステップと対応づけられない。
 *
 * 特定できなければ null を返す。**推測で埋めないこと。** 誤った面接官の評価として
 * 集計されるくらいなら「面接官不明」に寄せたほうがまだ読める。
 */
export function resolveInterviewerId(db, { studentUserId, statusKey }) {
  const row = db
    .prepare(
      `SELECT interviewer_id AS interviewerId
       FROM schedule_requests
       WHERE student_user_id = ? AND selection_status_key = ? AND status = ?
       ORDER BY booked_starts_at DESC, id DESC
       LIMIT 1`
    )
    .get(studentUserId, statusKey, SCHEDULE_REQUEST_STATUS.BOOKED);

  return row?.interviewerId ?? null;
}

/**
 * 回答の保存。
 *
 * @param {number} studentUserId 認証済みの本人。クライアントから受け取らないこと
 * @returns {{error: string}|{statusKey: string, answeredAt: string}}
 */
export function saveSurvey(db, { studentUserId, statusKey, rating, comment }) {
  const step = findAnswerableStep(db, studentUserId, statusKey);
  if (!step) return { error: 'まだ回答できない選考ステップです' };

  if (
    !Number.isInteger(rating) ||
    rating < INTERVIEW_SURVEY_RATING_MIN ||
    rating > INTERVIEW_SURVEY_RATING_MAX
  ) {
    return {
      error: `評価は${INTERVIEW_SURVEY_RATING_MIN}〜${INTERVIEW_SURVEY_RATING_MAX}で指定してください`,
    };
  }

  if (typeof comment !== 'string' && comment !== null && comment !== undefined) {
    return { error: 'ご意見の形式が不正です' };
  }
  const body = (comment ?? '').trim();
  if (body.length > INTERVIEW_SURVEY_COMMENT_MAX_LENGTH) {
    return { error: `ご意見は${INTERVIEW_SURVEY_COMMENT_MAX_LENGTH}文字以内で入力してください` };
  }

  const now = new Date().toISOString();
  const interviewerId = resolveInterviewerId(db, { studentUserId, statusKey });

  // 上書きはしない。二重送信や連打は「先に入った1件」を正としてそのまま返す
  // （UNIQUE 違反をエラーとして学生に見せる必要が無い）。
  db.prepare(
    `INSERT INTO interview_surveys
       (student_user_id, status_key, interviewer_id, rating, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_user_id, status_key) DO NOTHING`
  ).run(studentUserId, statusKey, interviewerId, rating, body || null, now);

  const saved = db
    .prepare(
      `SELECT created_at AS answeredAt FROM interview_surveys
       WHERE student_user_id = ? AND status_key = ?`
    )
    .get(studentUserId, statusKey);

  return { statusKey, answeredAt: saved.answeredAt };
}

/** 集計の母集団。人事向けなので student_user_id は最初から SELECT しない */
const SURVEY_SELECT_SQL = `
  SELECT s.id, s.status_key AS statusKey, s.interviewer_id AS interviewerId,
         s.rating, s.comment, s.created_at AS createdAt
  FROM interview_surveys s
`;

/** interviewerId（null 含む）を、画面で使うスコープIDに正規化する */
function toScopeId(interviewerId) {
  return interviewerId === null || interviewerId === undefined
    ? INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_ID
    : String(interviewerId);
}

/**
 * 面接官別の集計（人事のみ）。
 *
 * ★回答が INTERVIEW_SURVEY_MIN_SAMPLE 件に満たない面接官は個別の行にしない。
 *   面接日程と突き合わせれば誰の回答かが割れるため。件数だけ `suppressed` に
 *   まとめて返し、「隠している」こと自体は画面に出す（数字が合わないと
 *   ダッシュボード全体が信用されなくなる）。
 *
 * ★残る限界：全体平均と各面接官の平均から、伏せた面接官の平均は逆算できる。
 *   面接官の人数が少ないうちは避けられない。守るべき本丸は自由記述（誰が何を
 *   書いたか）で、そちらは listComments が同じ閾値で確実に落とす。
 */
export function buildInterviewSurveyView(db) {
  const rows = db.prepare(`${SURVEY_SELECT_SQL} ORDER BY s.created_at DESC`).all();

  const interviewerRows = db
    .prepare(
      `SELECT id, display_name AS displayName, department
       FROM calendar_interviewers ORDER BY id ASC`
    )
    .all();
  const nameOf = new Map(interviewerRows.map((row) => [String(row.id), row]));

  /** @type {Map<string, {count: number, total: number, breakdown: number[]}>} */
  const groups = new Map();
  let overallTotal = 0;

  for (const row of rows) {
    const scopeId = toScopeId(row.interviewerId);
    if (!groups.has(scopeId)) {
      groups.set(scopeId, {
        count: 0,
        total: 0,
        // 添字 0 が★1。INTERVIEW_SURVEY_RATING_MAX 段ぶん用意する
        breakdown: Array(INTERVIEW_SURVEY_RATING_MAX).fill(0),
      });
    }

    const group = groups.get(scopeId);
    group.count += 1;
    group.total += row.rating;
    group.breakdown[row.rating - INTERVIEW_SURVEY_RATING_MIN] += 1;
    overallTotal += row.rating;
  }

  const interviewers = [];
  let suppressedInterviewers = 0;
  let suppressedResponses = 0;

  for (const [scopeId, group] of groups) {
    if (group.count < INTERVIEW_SURVEY_MIN_SAMPLE) {
      suppressedInterviewers += 1;
      suppressedResponses += group.count;
      continue;
    }

    const known = nameOf.get(scopeId);
    interviewers.push({
      id: scopeId,
      displayName: known?.displayName ?? INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_LABEL,
      department: known?.department ?? null,
      isUnknown: scopeId === INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_ID,
      count: group.count,
      avgRating: roundAverage(group.total, group.count),
      ratingBreakdown: group.breakdown,
    });
  }

  // 平均の降順。同点は回答数の多い順（母数が大きいほうが上に来るのが自然）
  interviewers.sort((a, b) => b.avgRating - a.avgRating || b.count - a.count);

  return {
    interviewers,
    overall: {
      count: rows.length,
      avgRating: roundAverage(overallTotal, rows.length),
    },
    /** 匿名性の下限に届かず個別表示から落とした分。合計が合うように件数だけ返す */
    suppressed: {
      interviewerCount: suppressedInterviewers,
      responseCount: suppressedResponses,
    },
    minSampleSize: INTERVIEW_SURVEY_MIN_SAMPLE,
    /** 回答率の分母。面接を1つ以上通過した学生だけを数える */
    answerableCount: countAnswerableSteps(db),
  };
}

/**
 * その選考ステータスの学生が回答しうる面接ステップ（＝完了済みの面接ステップ）。
 *
 * ★「完了済みか」を数え直す場所を増やさないこと。
 *   学生の画面に出ているカードの数と分母がズレて、回答率が100%を超える。
 *   判定は selectionFlow の resolveStepStates に通し、seed もこの関数を使う。
 *
 * buildStudentFlow をそのまま呼ばないのは、FB・メモの取得が学生ごとに走って
 * ダッシュボード1回の表示で数百クエリになるため。ステップ設定は呼び出し側で
 * 1回だけ引いて渡す。
 *
 * @param {{statusKey: string, isEnabled: boolean}[]} allSteps listSelectionSteps の結果
 */
export function listAnswerableStatusKeys(allSteps, selectionStatus) {
  if (!selectionStatus || selectionStatus === SELECTION_STATUS.DECLINED) return [];

  // buildStudentFlow と同じ絞り込み（有効なステップ＋その学生の現在地）。
  // FB があるだけの無効ステップは含めないが、面接ステップの完了数は変わらない
  const steps = allSteps.filter(
    (step) => step.isEnabled || step.statusKey === selectionStatus
  );
  const states = resolveStepStates(selectionStatus, steps);

  return steps
    .filter(
      (step, index) =>
        states[index] === FLOW_STEP_STATE.DONE &&
        INTERVIEW_SURVEY_STATUS_KEYS.includes(step.statusKey)
    )
    .map((step) => step.statusKey);
}

/** 回答しうるステップの総数（回答率の分母）。辞退した学生は数えない */
function countAnswerableSteps(db) {
  const allSteps = listSelectionSteps(db);
  const students = db.prepare('SELECT selection_status AS selectionStatus FROM students').all();

  return students.reduce(
    (total, student) => total + listAnswerableStatusKeys(allSteps, student.selectionStatus).length,
    0
  );
}

/**
 * 指定スコープの自由記述（人事のみ・匿名）。
 *
 * ★絞り込みは必ずサーバで行う。全件をクライアントへ渡して画面側で絞る作りにすると、
 *   匿名性の下限（INTERVIEW_SURVEY_MIN_SAMPLE）が通信内容の時点で破れている。
 *
 * @param {string} scopeId 'all' / 面接官ID / 'unknown'
 */
export function listComments(db, scopeId) {
  const rows = db.prepare(`${SURVEY_SELECT_SQL} ORDER BY s.created_at DESC`).all();
  const withComment = rows.filter((row) => row.comment);

  if (scopeId === INTERVIEW_SURVEY_SCOPE_ALL) {
    // 全体スコープは面接官を伏せるので、回答数の少ない面接官のぶんも含めてよい。
    // 誰の面接についての記述かが分からなければ、書き手も特定できない。
    return { scopeId, isSuppressed: false, comments: withComment.map(toPublicComment) };
  }

  const scoped = rows.filter((row) => toScopeId(row.interviewerId) === scopeId);
  if (scoped.length < INTERVIEW_SURVEY_MIN_SAMPLE) {
    return { scopeId, isSuppressed: true, comments: [] };
  }

  return {
    scopeId,
    isSuppressed: false,
    comments: scoped.filter((row) => row.comment).map(toPublicComment),
  };
}

/**
 * 人事に返す1件ぶんの形。
 *
 * ★student_user_id はもちろん、回答日時も載せない。
 *   面接日程と突き合わせれば「この日に面接したのは誰か」で回答者が割れる。
 *   新しい順という並び順だけあれば読むには足りる。
 */
function toPublicComment(row) {
  return {
    id: row.id,
    statusKey: row.statusKey,
    stepLabel: SELECTION_STATUS_META[row.statusKey].label,
    rating: row.rating,
    body: row.comment,
  };
}
