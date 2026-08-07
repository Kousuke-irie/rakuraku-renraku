// P4-8: 個人ダッシュボードの集計。母数は **担当者1人ぶん**（rooms.assignee_user_id）。
//
// 全社版（dashboard.js）と同じ /dashboard の中でタブ切り替えして見る。
// 全社版が「取りこぼしがどこにあるか」を探す画面なのに対し、こちらは
// 「自分の持ち分がいまどうなっているか」を見る画面なので、指標を分けている。
//
// ★閲覧は人事全員（hr / admin）。他人を指定して見ることもできる。
//   monitoring.md §6 の「担当者別の集計もあえて全員に見せる＝相互監視のため」と同じ理由で、
//   隠すと取りこぼしの拾い上げが個人の努力に戻る。
import {
  AI_RECOMMENDED_PRIORITY_VALUES,
  HANDLING_STATUS,
  HANDLING_STATUS_VALUES,
  HOURS_IN_DAY,
  MESSAGE_TYPE,
  REPLY_LATENCY_BUCKET_KEYS,
  REPLY_STATE,
  ROLE,
  replyLatencyBucketOf,
  selectionPhaseOf,
} from '../../shared/constants.js';
import { AI_RESOLVED_SQL, EFFECTIVE_PRIORITY_SQL } from './effectivePriority.js';
import { listDashboardSelectionSteps } from './selectionFlow.js';
import { SLA_ESCALATE_HOURS, SLA_NOTIFY_HOURS } from './slaMonitor.js';

const MS_PER_HOUR = 3_600_000;

/**
 * 担当者の存在確認。**人事以外の id を渡されたら null を返す**。
 * 学生の id で個人ダッシュボードを引けてしまうと、担当ルーム0件の空画面が
 * 「担当者として実在する」ように見えてしまうため。
 */
export function findAssignee(db, assigneeId) {
  const row = db
    .prepare(`SELECT id, display_name AS displayName, role FROM users WHERE id = ?`)
    .get(assigneeId);

  if (!row || (row.role !== ROLE.HR && row.role !== ROLE.ADMIN)) return null;

  return { id: row.id, displayName: row.displayName };
}

/** 欠けた区分を0で埋めて、常に同じ順・同じ件数の配列にする */
function fillCounts(values, counts, key = 'key') {
  return values.map((value) => ({ [key]: value, count: counts.get(value) ?? 0 }));
}

/**
 * 対応ステータスの構成比。**5分類すべてを返す**（0件も含む）。
 * 欠けるとドーナツの凡例が回ごとに変わって、前回との比較ができなくなる。
 */
function buildHandlingBreakdown(db, assigneeId) {
  const counts = new Map(
    db
      .prepare(
        `SELECT handling_status AS status, COUNT(*) AS count
           FROM rooms
          WHERE assignee_user_id = ?
          GROUP BY handling_status`,
      )
      .all(assigneeId)
      .map((row) => [row.status, row.count]),
  );

  return fillCounts(HANDLING_STATUS_VALUES, counts, 'status');
}

/**
 * AI推奨度の構成比。
 *
 * ★受信箱と同じ実効値（AI が判定できなければ urgency に落ちる）で数える。
 *   `aiCount` は**そのうち AI 判定が効いた件数**で、AI 層がどれだけ寄与しているかを示す。
 *   件数と別に持つのは、コンプライアンス内訳（dashboard.js）と同じ考え方。
 */
function buildAiPriorityBreakdown(db, assigneeId) {
  const rows = db
    .prepare(
      `SELECT ${EFFECTIVE_PRIORITY_SQL} AS priority,
              COUNT(*) AS count,
              SUM(${AI_RESOLVED_SQL}) AS aiCount
         FROM rooms r
        WHERE r.assignee_user_id = ?
        GROUP BY priority`,
    )
    .all(assigneeId);

  const counts = new Map(rows.map((row) => [row.priority, row]));

  return AI_RECOMMENDED_PRIORITY_VALUES.map((priority) => ({
    priority,
    count: counts.get(priority)?.count ?? 0,
    aiCount: counts.get(priority)?.aiCount ?? 0,
  }));
}

/**
 * 返信状況。**対応ステータスとは独立の軸**として、時刻だけから機械的に決める。
 *
 * 対応ステータスは人が付けるので「対応中のまま2日放置」が起こりうる。
 * こちらは学生の最後の発言に人事が返したかどうかしか見ないので、その放置が必ず出る。
 */
function buildReplyStateBreakdown(db, assigneeId, now) {
  const rows = db
    .prepare(
      `SELECT
         r.last_student_message_at AS lastStudentMessageAt,
         (SELECT MAX(m.created_at)
            FROM messages m
           WHERE m.room_id = r.id
             AND m.deleted_at IS NULL
             AND m.type = @textType
             AND m.sender_id <> r.student_user_id) AS lastHrMessageAt
       FROM rooms r
      WHERE r.assignee_user_id = @assigneeId`,
    )
    .all({ assigneeId, textType: MESSAGE_TYPE.TEXT });

  const counts = new Map();
  const bump = (state) => counts.set(state, (counts.get(state) ?? 0) + 1);

  for (const row of rows) {
    // 学生がまだ一度も発言していないルームは「待たせていない」側に数える
    if (!row.lastStudentMessageAt) {
      bump(REPLY_STATE.REPLIED);
      continue;
    }

    // どちらも同じ形式の UTC ISO 文字列なので辞書順比較で時刻比較になる
    if (row.lastHrMessageAt && row.lastHrMessageAt >= row.lastStudentMessageAt) {
      bump(REPLY_STATE.REPLIED);
      continue;
    }

    const elapsed = (now - new Date(row.lastStudentMessageAt).getTime()) / MS_PER_HOUR;
    bump(elapsed < SLA_NOTIFY_HOURS ? REPLY_STATE.WAITING : REPLY_STATE.OVERDUE);
  }

  return [
    { state: REPLY_STATE.REPLIED, count: counts.get(REPLY_STATE.REPLIED) ?? 0 },
    { state: REPLY_STATE.WAITING, count: counts.get(REPLY_STATE.WAITING) ?? 0 },
    { state: REPLY_STATE.OVERDUE, count: counts.get(REPLY_STATE.OVERDUE) ?? 0 },
  ];
}

/**
 * 選考ステータス別。**段階と並びは会社の選考フロー設定に従う**（P2-11）。
 * 使っていない段階を出すとファネルに空の段が並んで読めなくなるため。
 * 有効な段階は**0人でも返す**（欠けると段が抜けて進行が追えない）。
 */
function buildSelectionBreakdown(db, assigneeId) {
  const counts = new Map(
    db
      .prepare(
        `SELECT st.selection_status AS status, COUNT(*) AS count
           FROM rooms r
           JOIN students st ON st.user_id = r.student_user_id
          WHERE r.assignee_user_id = ?
          GROUP BY st.selection_status`,
      )
      .all(assigneeId)
      .map((row) => [row.status, row.count]),
  );

  const countOf = (status) => counts.get(status) ?? 0;

  return listDashboardSelectionSteps(db, countOf).map((step) => ({
    status: step.statusKey,
    // 人事が付けた表示名。設定していなければ既定ラベル
    label: step.label,
    count: countOf(step.statusKey),
    phase: selectionPhaseOf(step.statusKey),
    /** false なら標準フロー外。設定変更後も学生が残っている段階 */
    isEnabled: step.isEnabled,
  }));
}

/**
 * 時間帯別のメッセージ数。人事と学生の2系列。
 *
 * ★**UTC の時刻で返す。** ローカル時刻への変換はクライアントが表示時に行う
 *   （CLAUDE.md §6-2）。JST は整数時間オフセットなので配列の回転で無損失に直せる。
 *   サーバに `+9 hours` を焼き込むと、DB の値だけ見て意味が取れなくなる。
 *
 * 0〜23 の**24点すべてを返す。** 欠けると折れ線の横軸が詰まってずれる（全社版の推移と同じ理由）。
 */
function buildHourlyActivity(db, assigneeId) {
  const rows = db
    .prepare(
      `SELECT
         CAST(strftime('%H', m.created_at) AS INTEGER) AS hour,
         SUM(CASE WHEN m.sender_id = r.student_user_id THEN 1 ELSE 0 END) AS studentCount,
         SUM(CASE WHEN m.sender_id = r.student_user_id THEN 0 ELSE 1 END) AS hrCount
       FROM messages m
       JOIN rooms r ON r.id = m.room_id
      WHERE r.assignee_user_id = @assigneeId
        AND m.deleted_at IS NULL
        AND m.type = @textType
      GROUP BY hour`,
    )
    .all({ assigneeId, textType: MESSAGE_TYPE.TEXT });

  const byHour = new Map(rows.map((row) => [row.hour, row]));

  return Array.from({ length: HOURS_IN_DAY }, (_, hourUtc) => ({
    hourUtc,
    hrCount: byHour.get(hourUtc)?.hrCount ?? 0,
    studentCount: byHour.get(hourUtc)?.studentCount ?? 0,
  }));
}

/**
 * 返信ペアの抽出。**学生の連続発言の先頭**から、次の人事の発言までを1件とする。
 *
 * ★「学生の最後の発言」からではなく「先頭」から測る。
 *   学生が3通続けて送って6時間後に返した場合、学生が待った体感は
 *   最後の1通からの時間ではなく最初の1通からの時間だから。
 *
 * 連続発言のグルーピングは gaps-and-islands（行番号の差が同一ブロック内で一定になる）。
 */
function selectReplyPairs(db, assigneeId) {
  return db
    .prepare(
      `WITH msg AS (
         SELECT m.id,
                m.room_id,
                m.created_at,
                CASE WHEN m.sender_id = r.student_user_id THEN 1 ELSE 0 END AS fromStudent
           FROM messages m
           JOIN rooms r ON r.id = m.room_id
          WHERE r.assignee_user_id = @assigneeId
            AND m.deleted_at IS NULL
            AND m.type = @textType
       ),
       streaks AS (
         SELECT room_id,
                fromStudent,
                created_at,
                ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at, id)
              - ROW_NUMBER() OVER (PARTITION BY room_id, fromStudent ORDER BY created_at, id) AS streak
           FROM msg
       ),
       bursts AS (
         SELECT room_id, fromStudent, streak, MIN(created_at) AS startedAt
           FROM streaks
          GROUP BY room_id, fromStudent, streak
       )
       SELECT b.startedAt AS askedAt,
              (SELECT MIN(nxt.startedAt)
                 FROM bursts nxt
                WHERE nxt.room_id = b.room_id
                  AND nxt.fromStudent = 0
                  AND nxt.startedAt > b.startedAt) AS repliedAt
         FROM bursts b
        WHERE b.fromStudent = 1`,
    )
    .all({ assigneeId, textType: MESSAGE_TYPE.TEXT })
    // まだ返信していないぶんは所要時間が確定していないので除く（返信状況の方で数えている）
    .filter((row) => row.repliedAt !== null);
}

function median(sorted) {
  if (sorted.length === 0) return null;

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);

/**
 * 返信所要時間の分布。
 *
 * ★中央値を主役にする。夜間や週末をまたいだ数件で平均は簡単に跳ねるため、
 *   平均だけ出すと「実感より遅い」数字になって信用されなくなる。平均は併記に留める。
 */
function buildReplyLatency(db, assigneeId) {
  const hours = selectReplyPairs(db, assigneeId)
    .map((row) => (new Date(row.repliedAt).getTime() - new Date(row.askedAt).getTime()) / MS_PER_HOUR)
    // 時刻の逆転（データ不整合）を捨てる。負の所要時間はどのバケットにも属さない
    .filter((value) => value >= 0);

  const counts = new Map();
  for (const value of hours) {
    const key = replyLatencyBucketOf(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = [...hours].sort((a, b) => a - b);
  const total = hours.reduce((sum, value) => sum + value, 0);

  return {
    buckets: fillCounts(REPLY_LATENCY_BUCKET_KEYS, counts),
    medianHours: round1(median(sorted)),
    averageHours: hours.length === 0 ? null : round1(total / hours.length),
    sampleSize: hours.length,
  };
}

/** 数字そのものが答えなので、この4つはグラフにしない（全社版の KPI タイルと同じ方針） */
function buildKpi(db, assigneeId, replyStateBreakdown, replyLatency) {
  const assignedStudents = db
    .prepare(`SELECT COUNT(*) AS count FROM rooms WHERE assignee_user_id = ?`)
    .get(assigneeId).count;

  const needsReply = db
    .prepare(
      `SELECT COUNT(*) AS count FROM rooms WHERE assignee_user_id = ? AND handling_status = ?`,
    )
    .get(assigneeId, HANDLING_STATUS.NEEDS_REPLY).count;

  const overdue =
    replyStateBreakdown.find((row) => row.state === REPLY_STATE.OVERDUE)?.count ?? 0;

  return { assignedStudents, needsReply, overdue, replyMedianHours: replyLatency.medianHours };
}

export function getPersonalDashboard(db, assigneeId, now = Date.now()) {
  const replyStateBreakdown = buildReplyStateBreakdown(db, assigneeId, now);
  const replyLatency = buildReplyLatency(db, assigneeId);

  return {
    kpi: buildKpi(db, assigneeId, replyStateBreakdown, replyLatency),
    handlingBreakdown: buildHandlingBreakdown(db, assigneeId),
    aiPriorityBreakdown: buildAiPriorityBreakdown(db, assigneeId),
    replyStateBreakdown,
    selectionBreakdown: buildSelectionBreakdown(db, assigneeId),
    hourlyActivity: buildHourlyActivity(db, assigneeId),
    replyLatency,
    thresholds: { notifyHours: SLA_NOTIFY_HOURS, escalateHours: SLA_ESCALATE_HOURS },
  };
}
