// P4-1: 通知一覧の取得・既読化。
//
// 自分宛（target_user_id = 自分）の通知だけを扱う。
// コンプライアンス警告は target_user_id が NULL なのでここには出ない
// （本人へは送信前ダイアログで伝え、集計はダッシュボード P4-4 が担う）。
//
// ★P4-7：`alerts` は人事の監視イベントと学生向けのお知らせを共用する。
//   **混ざらないための壁はこのファイルにある。** すべての読み出しに
//   AUDIENCE_SQL を付け、宛先ユーザーの users.role と kind の対応
//   （shared/constants.js の ALERT_KIND_AUDIENCE）を突き合わせる。
//   宛先を取り違えて INSERT しても、ロールに合わない kind は返らない。
import {
  ALERT_AUDIENCE,
  ALERT_KIND_AUDIENCE,
  HR_ALERT_KINDS,
  IMPORTANT_ALERT_KINDS,
  ROLE,
  SLA_ALERT_KINDS,
  STUDENT_ALERT_KINDS,
} from '../../shared/constants.js';

/**
 * 列挙値を名前付きプレースホルダに展開する。
 * SQL に値を直接埋め込まない（CLAUDE.md §6-5）。better-sqlite3 は名前付きと
 * 無名のバインドを混在できないので、既存の @userId 等に合わせて名前付きで作る。
 */
function namedList(prefix, values) {
  return {
    sql: values.map((_value, index) => `@${prefix}${index}`).join(', '),
    params: Object.fromEntries(values.map((value, index) => [`${prefix}${index}`, value])),
  };
}

const STUDENT_KINDS = namedList('studentKind', STUDENT_ALERT_KINDS);
const HR_KINDS = namedList('hrKind', HR_ALERT_KINDS);

/**
 * 読者の壁。宛先が学生なら学生向けの kind だけ、人事なら人事向けの kind だけ。
 * どちらの一覧にも載らない kind（対応表に無いもの）は返らない＝安全側に倒れる。
 */
const AUDIENCE_SQL = `
  AND (
    CASE WHEN tu.role = @studentRole
      THEN a.kind IN (${STUDENT_KINDS.sql})
      ELSE a.kind IN (${HR_KINDS.sql})
    END
  )
`;

const AUDIENCE_PARAMS = Object.freeze({
  studentRole: ROLE.STUDENT,
  ...STUDENT_KINDS.params,
  ...HR_KINDS.params,
});

/**
 * UPDATE 文用の同じ壁。JOIN が書けないので EXISTS で表現する。
 * 既読化も「自分の読者区分の通知にしか触れない」を保つ
 * （壁が読み出しだけだと、見えない通知を既読にできてしまう）。
 */
const AUDIENCE_EXISTS_SQL = `
  AND EXISTS (
    SELECT 1 FROM users tu
     WHERE tu.id = a.target_user_id
       ${AUDIENCE_SQL}
  )
`;

// tu（宛先ユーザー）は AUDIENCE_SQL のための JOIN。INNER なので
// target_user_id が NULL のコンプライアンス記録は最初から外れる。
const ALERT_SELECT_SQL = `
  SELECT
    a.id,
    a.kind,
    a.severity,
    a.room_id       AS roomId,
    a.detail,
    a.created_at    AS createdAt,
    a.read_at       AS readAt,
    a.resolved_at   AS resolvedAt,
    su.display_name AS studentName,
    au.display_name AS assigneeName,
    r.last_student_message_at AS lastStudentMessageAt
  FROM alerts a
  JOIN rooms r ON r.id = a.room_id
  JOIN users tu ON tu.id = a.target_user_id
  LEFT JOIN users su ON su.id = r.student_user_id
  LEFT JOIN users au ON au.id = a.actor_user_id
`;

/** 学生向けの通知か。返す情報を絞るのに使う */
function isStudentAudience(kind) {
  return ALERT_KIND_AUDIENCE[kind] === ALERT_AUDIENCE.STUDENT;
}

function elapsedHours(isoString) {
  if (!isoString) return null;
  return Math.round(((Date.now() - new Date(isoString).getTime()) / 3_600_000) * 10) / 10;
}

export function toAlert(row) {
  if (!row) return null;

  // 学生本人への通知に氏名・担当者名は載せない（P4-7）。
  // 自分の名前は情報にならず、**FBを書いた人事が誰かは本人に伝える必要が無い**。
  const forStudent = isStudentAudience(row.kind);

  return {
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    roomId: row.roomId,
    studentName: forStudent ? null : row.studentName,
    assigneeName: forStudent ? null : row.assigneeName,
    detail: row.detail,
    createdAt: row.createdAt,
    readAt: row.readAt,
    resolvedAt: row.resolvedAt,
    elapsedHours: elapsedHours(row.lastStudentMessageAt),
  };
}

/**
 * 自分宛の通知を新しい順に返す。
 *
 * 既定では**解消済みを含めない**。返信して片付いた通知が一覧に残り続けると、
 * 「上から処理すれば終わる」というコンセプトが崩れるため。
 *
 * @param {{unreadOnly?: boolean, includeResolved?: boolean, limit?: number}} options
 */
export function listAlertsForUser(db, userId, options = {}) {
  const { unreadOnly = false, includeResolved = false, limit = 50 } = options;

  return db
    .prepare(
      `${ALERT_SELECT_SQL}
        WHERE a.target_user_id = @userId
          AND (@unreadOnly = 0 OR a.read_at IS NULL)
          AND (@includeResolved = 1 OR a.resolved_at IS NULL)
          ${AUDIENCE_SQL}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT @limit`,
    )
    .all({
      ...AUDIENCE_PARAMS,
      userId,
      unreadOnly: unreadOnly ? 1 : 0,
      includeResolved: includeResolved ? 1 : 0,
      limit,
    })
    .map(toAlert);
}

// 件数系も同じ壁を通す。一覧に出ないものが件数に入ると、
// 「バッジは1件なのに一覧は空」という状態が生まれる。
const COUNT_FROM_SQL = `
  FROM alerts a
  JOIN users tu ON tu.id = a.target_user_id
  WHERE a.target_user_id = @userId
    AND a.read_at IS NULL
    AND a.resolved_at IS NULL
    ${AUDIENCE_SQL}
`;

/** ナビレールのバッジ用。未読かつ未解消の件数。 */
export function countUnreadAlerts(db, userId) {
  return db
    .prepare(`SELECT COUNT(*) AS count ${COUNT_FROM_SQL}`)
    .get({ ...AUDIENCE_PARAMS, userId }).count;
}

/**
 * 未読のうち「重要」なものの件数（P4-6）。
 * 接続時のまとめバナーを強調するかの判断だけに使う。
 */
export function countUnreadImportantAlerts(db, userId) {
  const important = namedList('importantKind', IMPORTANT_ALERT_KINDS);

  return db
    .prepare(`SELECT COUNT(*) AS count ${COUNT_FROM_SQL} AND a.kind IN (${important.sql})`)
    .get({ ...AUDIENCE_PARAMS, ...important.params, userId }).count;
}

export function findAlertForUser(db, userId, alertId) {
  return toAlert(
    db
      .prepare(
        `${ALERT_SELECT_SQL}
          WHERE a.id = @alertId
            AND a.target_user_id = @userId
            ${AUDIENCE_SQL}`,
      )
      .get({ ...AUDIENCE_PARAMS, alertId, userId }),
  );
}

/**
 * 既読にする。**自分宛のものしか更新できない**（CLAUDE.md §6-6）。
 * @returns {boolean} 対象が存在して更新できたか
 */
export function markAlertRead(db, userId, alertId, now = Date.now()) {
  const params = { ...AUDIENCE_PARAMS, now: new Date(now).toISOString(), alertId, userId };

  const result = db
    .prepare(
      `UPDATE alerts AS a
          SET read_at = @now
        WHERE a.id = @alertId
          AND a.target_user_id = @userId
          AND a.read_at IS NULL
          ${AUDIENCE_EXISTS_SQL}`,
    )
    .run(params);

  if (result.changes > 0) return true;

  // 既に既読でも「存在はする」なら成功扱いにする（二重クリックで404にしない）
  return Boolean(
    db
      .prepare(
        `SELECT 1
           FROM alerts AS a
          WHERE a.id = @alertId
            AND a.target_user_id = @userId
            ${AUDIENCE_EXISTS_SQL}`,
      )
      .get(params),
  );
}

/** @returns {number} 既読にした件数 */
export function markAllAlertsRead(db, userId, now = Date.now()) {
  return db
    .prepare(
      `UPDATE alerts AS a
          SET read_at = @now
        WHERE a.target_user_id = @userId
          AND a.read_at IS NULL
          AND a.resolved_at IS NULL
          ${AUDIENCE_EXISTS_SQL}`,
    )
    .run({ ...AUDIENCE_PARAMS, now: new Date(now).toISOString(), userId }).changes;
}

export { SLA_ALERT_KINDS };
