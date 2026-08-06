// P2-5/P2-6: 申し送りメモ。REST（routes/memos.js）から呼ぶ問い合わせと整形をここに集約する。
// ハンドラ側にSQLとロジックを直書きしない（api.md §4-7）。

import { MEMO_SCOPE } from '../../shared/constants.js';

export class MemoNotFoundError extends Error {
  constructor(message = 'メモが存在しません') {
    super(message);
    this.name = 'MemoNotFoundError';
    this.code = 'not_found';
    this.statusCode = 404;
  }
}

export class MemoForbiddenError extends Error {
  constructor(message = '自分が作成したメモのみ操作できます') {
    super(message);
    this.name = 'MemoForbiddenError';
    this.code = 'forbidden';
    this.statusCode = 403;
  }
}

const MEMO_SELECT_SQL = `
  SELECT
    m.id,
    m.room_id       AS roomId,
    m.body,
    m.scope,
    m.created_at    AS createdAt,
    m.updated_at    AS updatedAt,
    u.id            AS authorId,
    u.display_name  AS authorDisplayName
  FROM memos m
  JOIN users u ON u.id = m.author_id
`;

// クライアント（rooms ストア・MemoPanel）が期待する形。
// author は room.assignee と同じ { id, displayName } に揃える。
function toMemo(row) {
  if (!row) return null;

  return {
    id: row.id,
    roomId: row.roomId,
    author: { id: row.authorId, displayName: row.authorDisplayName },
    body: row.body,
    scope: row.scope,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function findMemoById(db, memoId) {
  return toMemo(db.prepare(`${MEMO_SELECT_SQL} WHERE m.id = ?`).get(memoId));
}

/**
 * ルームのメモ一覧。**共有メモは全員に、個人メモは作成者本人にだけ**返す。
 * 更新の新しい順（引き継ぎ時に最新の申し送りが上に来る）。
 */
export function listMemos(db, { roomId, userId }) {
  return db
    .prepare(
      `${MEMO_SELECT_SQL}
       WHERE m.room_id = ?
         AND (m.scope = ? OR m.author_id = ?)
       ORDER BY m.updated_at DESC, m.id DESC`
    )
    .all(roomId, MEMO_SCOPE.SHARED, userId)
    .map(toMemo);
}

export function createMemo(db, { roomId, authorId, body, scope }) {
  const now = new Date().toISOString();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO memos (room_id, author_id, body, scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(roomId, authorId, body, scope, now, now);

  return findMemoById(db, lastInsertRowid);
}

/**
 * 本文の更新と scope の共有昇格（P2-6）。
 * 作成者本人のみ。`shared → private` の降格は許可しない
 * （既に他の人事へ配信済みの内容を、相手の画面から消す手段が無いため）。
 * @returns {object} 更新後のメモ
 */
export function updateMemo(db, { memoId, userId, body, scope }) {
  const memo = findMemoById(db, memoId);
  if (!memo) throw new MemoNotFoundError();
  if (memo.author.id !== userId) throw new MemoForbiddenError();

  const nextBody = body ?? memo.body;
  const nextScope = scope ?? memo.scope;

  if (memo.scope === MEMO_SCOPE.SHARED && nextScope === MEMO_SCOPE.PRIVATE) {
    throw new MemoForbiddenError('共有メモを個人メモに戻すことはできません');
  }

  db.prepare('UPDATE memos SET body = ?, scope = ?, updated_at = ? WHERE id = ?').run(
    nextBody,
    nextScope,
    new Date().toISOString(),
    memoId
  );

  return findMemoById(db, memoId);
}

/**
 * 削除。作成者本人のみ。
 * @returns {object} 削除したメモ（呼び出し側が roomId を使うため）
 */
export function deleteMemo(db, { memoId, userId }) {
  const memo = findMemoById(db, memoId);
  if (!memo) throw new MemoNotFoundError();
  if (memo.author.id !== userId) throw new MemoForbiddenError();

  db.prepare('DELETE FROM memos WHERE id = ?').run(memoId);
  return memo;
}
