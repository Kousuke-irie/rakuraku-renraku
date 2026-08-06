// 定型文の管理（設定画面・P2-1 拡張）。REST（routes/snippets.js）から呼ぶ問い合わせをここに集約する。

export class SnippetNotFoundError extends Error {
  constructor(message = '定型文が存在しません') {
    super(message);
    this.name = 'SnippetNotFoundError';
    this.code = 'not_found';
    this.statusCode = 404;
  }
}

export class SnippetConflictError extends Error {
  constructor(message = 'そのコマンドは既に使われています') {
    super(message);
    this.name = 'SnippetConflictError';
    this.code = 'conflict';
    this.statusCode = 409;
  }
}

const SNIPPET_SELECT_SQL = 'SELECT id, command, title, body, sort_order AS sortOrder FROM snippets';

function findSnippetById(db, id) {
  return db.prepare(`${SNIPPET_SELECT_SQL} WHERE id = ?`).get(id) ?? null;
}

function isDuplicateCommand(db, command, excludeId = null) {
  const row = db.prepare('SELECT id FROM snippets WHERE command = ?').get(command);
  return Boolean(row) && row.id !== excludeId;
}

export function listSnippets(db) {
  return db.prepare(`${SNIPPET_SELECT_SQL} ORDER BY sort_order ASC`).all();
}

export function createSnippet(db, { command, title, body }) {
  if (isDuplicateCommand(db, command)) throw new SnippetConflictError();

  const nextSortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM snippets').get().next;

  const { lastInsertRowid } = db
    .prepare('INSERT INTO snippets (command, title, body, sort_order) VALUES (?, ?, ?, ?)')
    .run(command, title, body, nextSortOrder);

  return findSnippetById(db, lastInsertRowid);
}

export function updateSnippet(db, { id, command, title, body }) {
  const snippet = findSnippetById(db, id);
  if (!snippet) throw new SnippetNotFoundError();

  const nextCommand = command ?? snippet.command;
  if (isDuplicateCommand(db, nextCommand, id)) throw new SnippetConflictError();

  db.prepare('UPDATE snippets SET command = ?, title = ?, body = ? WHERE id = ?').run(
    nextCommand,
    title ?? snippet.title,
    body ?? snippet.body,
    id
  );

  return findSnippetById(db, id);
}

export function deleteSnippet(db, id) {
  const snippet = findSnippetById(db, id);
  if (!snippet) throw new SnippetNotFoundError();

  db.prepare('DELETE FROM snippets WHERE id = ?').run(id);
}
