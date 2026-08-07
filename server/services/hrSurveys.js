// 人事FBアンケート（S-12）。選考が終わった学生が、担当人事の**対応**を
// 3軸★5段階＋自由記述で答え、人事はダッシュボードで担当者別に読む。
//
// ★このサービスの最重要責務は匿名化。interviewSurveys.js と同じ思想だが、
//   こちらのほうが危うい。担当学生は固定なので「先週内定を出したあの子だ」と
//   担当者本人がまず特定できる。**人事向けの戻り値に student_user_id・氏名・
//   ルームIDを載せないこと。** student_user_id を持つのは「1学生1回だけ」を
//   UNIQUE で担保するためだけで、読み出しには使わない。
//
// ★回答は1回きりで上書きしない。学生カードが「ご回答ありがとうございました」で
//   終端する既存UI（S-11）に合わせる（schema.sql に updated_at が無いのはそのため）。
//
// ★S-11（面接アンケート）と定数もテーブルも共用しない。
//   主語が「面接官の面接」と「担当人事のやり取り」で違い、母数も評価軸も違う。

import {
  HR_SURVEY_AXIS,
  HR_SURVEY_AXIS_META,
  HR_SURVEY_AXIS_VALUES,
  HR_SURVEY_COMMENT_MAX_LENGTH,
  HR_SURVEY_MIN_SAMPLE,
  HR_SURVEY_RATING_MAX,
  HR_SURVEY_RATING_MIN,
  HR_SURVEY_SCOPE_ALL,
  HR_SURVEY_UNKNOWN_ASSIGNEE_ID,
  HR_SURVEY_UNKNOWN_ASSIGNEE_LABEL,
  SELECTION_STATUS_META,
  isHrSurveyAnswerable,
} from '../../shared/constants.js';

/** 平均は小数第1位まで。バーの長さで比べる用途にこれ以上の桁は要らない */
function roundAverage(total, count) {
  if (count === 0) return null;
  return Math.round((total / count) * 10) / 10;
}

/** 集計の母集団。人事向けなので student_user_id は最初から SELECT しない */
const SURVEY_SELECT_SQL = `
  SELECT s.id, s.assignee_user_id AS assigneeUserId, s.outcome_status AS outcomeStatus,
         s.rating_speed AS speed, s.rating_clarity AS clarity, s.rating_courtesy AS courtesy,
         s.comment, s.created_at AS createdAt
  FROM hr_surveys s
`;

/**
 * 1件ぶんの3軸の合計。
 * 「総合満足度」は3軸の平均で表し、独立した設問を持たない。
 * 設問を1つ増やすより回答負荷が軽く、総合と各軸が食い違うこともない。
 */
function totalOf(row) {
  return HR_SURVEY_AXIS_VALUES.reduce((sum, axis) => sum + row[axis], 0);
}

/** assigneeUserId（null 含む）を、画面で使うスコープIDに正規化する */
function toScopeId(assigneeUserId) {
  return assigneeUserId === null || assigneeUserId === undefined
    ? HR_SURVEY_UNKNOWN_ASSIGNEE_ID
    : String(assigneeUserId);
}

/**
 * その学生が回答済みか。
 * マイページのカードを「お礼メッセージ」に切り替えるために使う。
 */
export function hasAnsweredHrSurvey(db, studentUserId) {
  const row = db
    .prepare('SELECT 1 AS answered FROM hr_surveys WHERE student_user_id = ?')
    .get(studentUserId);

  return Boolean(row);
}

/**
 * その学生の選考結果。回答してよい状態でなければ null。
 *
 * ★判定を isHrSurveyAnswerable（＝ selectionPhaseOf）に通すこと。
 *   「選考が終わったか」を2箇所で計算すると必ずズレる。学生の画面にカードが
 *   出ていないのに POST できてしまう、あるいはその逆が起きる。
 *
 * @returns {string|null} 'offer' / 'declined'（＝ hr_surveys.outcome_status）
 */
export function resolveSurveyOutcome(db, studentUserId) {
  const row = db
    .prepare('SELECT selection_status AS selectionStatus FROM students WHERE user_id = ?')
    .get(studentUserId);
  if (!row) return null;

  return isHrSurveyAnswerable(row.selectionStatus) ? row.selectionStatus : null;
}

/**
 * 回答時点の担当人事を特定する。
 *
 * その学生のルームの `assignee_user_id` をコピーする。未割当なら null を返す。
 * **推測で埋めないこと。** 誤った担当者の評価として集計されるくらいなら
 * 「担当者未割当」に寄せたほうがまだ読める（S-11 の面接官不明と同じ考え方）。
 */
export function resolveAssigneeId(db, studentUserId) {
  const row = db
    .prepare('SELECT assignee_user_id AS assigneeUserId FROM rooms WHERE student_user_id = ?')
    .get(studentUserId);

  return row?.assigneeUserId ?? null;
}

/** 3軸すべてが★の範囲内の整数か。1つでも欠けたら受け付けない（部分回答を作らない） */
function parseRatings(input) {
  const ratings = {};

  for (const axis of HR_SURVEY_AXIS_VALUES) {
    const value = Number(input?.[axis]);
    if (
      !Number.isInteger(value) ||
      value < HR_SURVEY_RATING_MIN ||
      value > HR_SURVEY_RATING_MAX
    ) {
      return {
        error:
          `「${HR_SURVEY_AXIS_META[axis].label}」は` +
          `${HR_SURVEY_RATING_MIN}〜${HR_SURVEY_RATING_MAX}で指定してください`,
      };
    }
    ratings[axis] = value;
  }

  return { ratings };
}

/**
 * 回答の保存。
 *
 * @param {number} studentUserId 認証済みの本人。クライアントから受け取らないこと
 * @param {object} ratings HR_SURVEY_AXIS をキーにした★（3軸すべて必須）
 * @returns {{error: string}|{answeredAt: string}}
 */
export function saveHrSurvey(db, { studentUserId, ratings: input, comment }) {
  const outcome = resolveSurveyOutcome(db, studentUserId);
  if (!outcome) return { error: '選考が終了した方のみご回答いただけます' };

  const parsed = parseRatings(input);
  if (parsed.error) return { error: parsed.error };

  if (typeof comment !== 'string' && comment !== null && comment !== undefined) {
    return { error: 'ご意見の形式が不正です' };
  }
  const body = (comment ?? '').trim();
  if (body.length > HR_SURVEY_COMMENT_MAX_LENGTH) {
    return { error: `ご意見は${HR_SURVEY_COMMENT_MAX_LENGTH}文字以内で入力してください` };
  }

  const now = new Date().toISOString();
  const assigneeUserId = resolveAssigneeId(db, studentUserId);

  // 上書きはしない。二重送信や連打は「先に入った1件」を正としてそのまま返す
  // （UNIQUE 違反をエラーとして学生に見せる必要が無い）。
  db.prepare(
    `INSERT INTO hr_surveys
       (student_user_id, assignee_user_id, outcome_status,
        rating_speed, rating_clarity, rating_courtesy, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_user_id) DO NOTHING`
  ).run(
    studentUserId,
    assigneeUserId,
    outcome,
    parsed.ratings[HR_SURVEY_AXIS.SPEED],
    parsed.ratings[HR_SURVEY_AXIS.CLARITY],
    parsed.ratings[HR_SURVEY_AXIS.COURTESY],
    body || null,
    now
  );

  const saved = db
    .prepare('SELECT created_at AS answeredAt FROM hr_surveys WHERE student_user_id = ?')
    .get(studentUserId);

  return { answeredAt: saved.answeredAt };
}

/** 学生マイページ（GET /selection-flow/me）に載せる状態 */
export function buildHrSurveyState(db, studentUserId) {
  const outcome = resolveSurveyOutcome(db, studentUserId);

  return {
    /** カードを出してよいか（＝選考が終わっているか） */
    answerable: outcome !== null,
    answered: hasAnsweredHrSurvey(db, studentUserId),
    /** 'offer' / 'declined' / null。カードの文面を切り替えるために使う */
    outcome,
    outcomeLabel: outcome ? SELECTION_STATUS_META[outcome].label : null,
  };
}

/** 空の集計値。回答0件でも画面のキーが欠けないようにする */
function emptyAggregate() {
  return {
    count: 0,
    total: 0,
    axisTotals: Object.fromEntries(HR_SURVEY_AXIS_VALUES.map((axis) => [axis, 0])),
  };
}

function addToAggregate(aggregate, row) {
  aggregate.count += 1;
  aggregate.total += totalOf(row);
  for (const axis of HR_SURVEY_AXIS_VALUES) {
    aggregate.axisTotals[axis] += row[axis];
  }
}

function toAverages(aggregate) {
  return {
    count: aggregate.count,
    // 総合は「3軸すべての★の平均」。回答数×軸数で割る
    avgOverall: roundAverage(aggregate.total, aggregate.count * HR_SURVEY_AXIS_VALUES.length),
    axisAverages: Object.fromEntries(
      HR_SURVEY_AXIS_VALUES.map((axis) => [
        axis,
        roundAverage(aggregate.axisTotals[axis], aggregate.count),
      ])
    ),
  };
}

/**
 * 回答率の分母。選考が終わっていて、回答しうる学生の数。
 *
 * ★「選考が終わったか」を数え直す場所を増やさないこと。
 *   学生の画面にカードが出ている数と分母がズレて、回答率が100%を超える。
 *   判定は isHrSurveyAnswerable に通し、seed もこの関数と同じ判定を使う。
 */
export function countAnswerableStudents(db) {
  const rows = db.prepare('SELECT selection_status AS selectionStatus FROM students').all();
  return rows.filter((row) => isHrSurveyAnswerable(row.selectionStatus)).length;
}

/**
 * 担当者別の集計（人事のみ）。
 *
 * ★回答が HR_SURVEY_MIN_SAMPLE 件に満たない担当者は個別の行にしない。
 *   担当学生は固定なので、件数が少ないと担当者本人が回答者を特定できるため。
 *   件数だけ `suppressed` にまとめて返し、「隠している」こと自体は画面に出す
 *   （数字が合わないとダッシュボード全体が信用されなくなる）。
 *
 * ★残る限界：全体平均と各担当者の平均から、伏せた担当者の平均は逆算できる。
 *   担当者が少ないうちは避けられない。守るべき本丸は自由記述（誰が何を書いたか）で、
 *   そちらは listHrSurveyComments が同じ閾値で確実に落とす。
 */
export function buildHrSurveyView(db) {
  const rows = db.prepare(`${SURVEY_SELECT_SQL} ORDER BY s.created_at DESC`).all();

  const assigneeRows = db
    .prepare(`SELECT id, display_name AS displayName FROM users ORDER BY id ASC`)
    .all();
  const nameOf = new Map(assigneeRows.map((row) => [String(row.id), row]));

  /** @type {Map<string, ReturnType<typeof emptyAggregate>>} */
  const groups = new Map();
  const overall = emptyAggregate();
  /** 選考結果別。内定者と辞退者では傾向が違うので分けて出す */
  const byOutcome = new Map();

  for (const row of rows) {
    const scopeId = toScopeId(row.assigneeUserId);
    if (!groups.has(scopeId)) groups.set(scopeId, emptyAggregate());
    addToAggregate(groups.get(scopeId), row);

    if (!byOutcome.has(row.outcomeStatus)) byOutcome.set(row.outcomeStatus, emptyAggregate());
    addToAggregate(byOutcome.get(row.outcomeStatus), row);

    addToAggregate(overall, row);
  }

  const assignees = [];
  let suppressedAssignees = 0;
  let suppressedResponses = 0;

  for (const [scopeId, aggregate] of groups) {
    if (aggregate.count < HR_SURVEY_MIN_SAMPLE) {
      suppressedAssignees += 1;
      suppressedResponses += aggregate.count;
      continue;
    }

    const known = nameOf.get(scopeId);
    assignees.push({
      id: scopeId,
      displayName: known?.displayName ?? HR_SURVEY_UNKNOWN_ASSIGNEE_LABEL,
      isUnknown: scopeId === HR_SURVEY_UNKNOWN_ASSIGNEE_ID,
      ...toAverages(aggregate),
    });
  }

  // 総合平均の降順。同点は回答数の多い順（母数が大きいほうが上に来るのが自然）
  assignees.sort((a, b) => b.avgOverall - a.avgOverall || b.count - a.count);

  return {
    assignees,
    overall: toAverages(overall),
    /** 選考結果別の平均。伏せない（個人ではなく区分の集計なので特定に繋がらない） */
    outcomes: [...byOutcome.entries()].map(([outcomeStatus, aggregate]) => ({
      outcomeStatus,
      label: SELECTION_STATUS_META[outcomeStatus].label,
      ...toAverages(aggregate),
    })),
    /** 匿名性の下限に届かず個別表示から落とした分。合計が合うように件数だけ返す */
    suppressed: {
      assigneeCount: suppressedAssignees,
      responseCount: suppressedResponses,
    },
    minSampleSize: HR_SURVEY_MIN_SAMPLE,
    answerableCount: countAnswerableStudents(db),
  };
}

/**
 * 担当者1人ぶんの集計（個人ダッシュボード・P4-8 のタブに載せる）。
 *
 * ★下限未満なら数字を返さない。**本人が自分のぶんを見る場合も同じ。**
 *   「自分なら見てよい」にすると、担当者は誰が答えたか分かる状態で読むことになり、
 *   学生への「特定されません」という約束が崩れる。
 */
export function buildAssigneeHrSurvey(db, assigneeId) {
  const rows = db
    .prepare(`${SURVEY_SELECT_SQL} WHERE s.assignee_user_id = ? ORDER BY s.created_at DESC`)
    .all(assigneeId);

  const aggregate = emptyAggregate();
  for (const row of rows) addToAggregate(aggregate, row);

  const isSuppressed = rows.length < HR_SURVEY_MIN_SAMPLE;
  const averages = toAverages(aggregate);

  return {
    isSuppressed,
    minSampleSize: HR_SURVEY_MIN_SAMPLE,
    /** 伏せる場合でも件数は返す。「あと何件で読めるようになるか」が分かるため */
    count: rows.length,
    avgOverall: isSuppressed ? null : averages.avgOverall,
    axisAverages: isSuppressed ? null : averages.axisAverages,
    /** その担当者の学生のうち、選考が終わっている人数（回答率の分母） */
    answerableCount: countAnswerableAssignedStudents(db, assigneeId),
  };
}

/** 担当者1人ぶんの回答率の分母 */
function countAnswerableAssignedStudents(db, assigneeId) {
  const rows = db
    .prepare(
      `SELECT s.selection_status AS selectionStatus
       FROM students s
       JOIN rooms r ON r.student_user_id = s.user_id
       WHERE r.assignee_user_id = ?`
    )
    .all(assigneeId);

  return rows.filter((row) => isHrSurveyAnswerable(row.selectionStatus)).length;
}

/**
 * 指定スコープの自由記述（人事のみ・匿名）。
 *
 * ★絞り込みは必ずサーバで行う。全件をクライアントへ渡して画面側で絞る作りにすると、
 *   匿名性の下限（HR_SURVEY_MIN_SAMPLE）が通信内容の時点で破れている。
 *
 * @param {string} scopeId 'all' / 担当者ID / 'unknown'
 */
export function listHrSurveyComments(db, scopeId) {
  const rows = db.prepare(`${SURVEY_SELECT_SQL} ORDER BY s.created_at DESC`).all();
  const withComment = rows.filter((row) => row.comment);

  if (scopeId === HR_SURVEY_SCOPE_ALL) {
    // 全体スコープは担当者を伏せるので、回答数の少ない担当者のぶんも含めてよい。
    // 誰の対応についての記述かが分からなければ、書き手も特定できない。
    return { scopeId, isSuppressed: false, comments: withComment.map(toPublicComment) };
  }

  const scoped = rows.filter((row) => toScopeId(row.assigneeUserId) === scopeId);
  if (scoped.length < HR_SURVEY_MIN_SAMPLE) {
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
 *   選考の終了日と突き合わせれば「この時期に内定を出したのは誰か」で回答者が割れる。
 *   新しい順という並び順だけあれば読むには足りる（S-11 と同じ判断）。
 */
function toPublicComment(row) {
  return {
    id: row.id,
    outcomeStatus: row.outcomeStatus,
    outcomeLabel: SELECTION_STATUS_META[row.outcomeStatus].label,
    avgOverall: roundAverage(totalOf(row), HR_SURVEY_AXIS_VALUES.length),
    ratings: Object.fromEntries(HR_SURVEY_AXIS_VALUES.map((axis) => [axis, row[axis]])),
    body: row.comment,
  };
}
