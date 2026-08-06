// 学生の選考メモ（S-10）
//
// 学生が自分のマイページで書く、**本人にしか見えない**メモ。
// 粒度は2つ：選考ステップごと（逆質問の準備・面接の振り返り）と、
// 選考全体（志望動機の軸・企業研究）。後者は note_key = 'overall' で表す。
//
// ★このモジュールに「人事が学生のメモを読む」関数を足さないこと。
//   本人しか見ないと分かっているから率直に書ける、というのがこの機能の価値そのもので、
//   覗ける経路を1つでも作ると機能ごと意味を失う。
//   人事の申し送りメモは services/memos.js（別テーブル）。混ぜない。

import { STUDENT_NOTE_OVERALL_KEY } from '../../shared/constants.js';

const NOTE_SELECT_SQL = `
  SELECT note_key AS noteKey, body, updated_at AS updatedAt
  FROM student_notes
`;

/**
 * 学生本人のメモを note_key をキーにして引く。
 * @param {number} studentUserId 認証済みの本人。クライアントから受け取らないこと
 * @returns {Map<string, {noteKey: string, body: string, updatedAt: string}>}
 */
export function findNotesByStudent(db, studentUserId) {
  const rows = db.prepare(`${NOTE_SELECT_SQL} WHERE student_user_id = ?`).all(studentUserId);

  return new Map(rows.map((row) => [row.noteKey, row]));
}

/** 選考全体のメモ。マイページ下部の独立カード用 */
export function findOverallNote(db, studentUserId) {
  return (
    db
      .prepare(`${NOTE_SELECT_SQL} WHERE student_user_id = ? AND note_key = ?`)
      .get(studentUserId, STUDENT_NOTE_OVERALL_KEY) ?? null
  );
}

/**
 * メモの保存。学生×キーで1件なので UPSERT。
 * 空文字を渡されたら削除する（「書いたものを消す」を表現するため）。
 *
 * @param {number} studentUserId 認証済みの本人
 * @returns {object|null} 保存後のメモ。削除したときは null
 */
export function saveNote(db, { studentUserId, noteKey, body }) {
  if (!body) {
    db.prepare('DELETE FROM student_notes WHERE student_user_id = ? AND note_key = ?').run(
      studentUserId,
      noteKey
    );
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO student_notes (student_user_id, note_key, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(student_user_id, note_key) DO UPDATE SET
       body = excluded.body,
       updated_at = excluded.updated_at`
  ).run(studentUserId, noteKey, body, now, now);

  return db
    .prepare(`${NOTE_SELECT_SQL} WHERE student_user_id = ? AND note_key = ?`)
    .get(studentUserId, noteKey);
}
