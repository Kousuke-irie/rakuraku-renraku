import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { saveNote } from '../services/studentNotes.js';
import {
  ROLE,
  STUDENT_NOTE_KEY_VALUES,
  STUDENT_NOTE_MAX_LENGTH,
} from '../../shared/constants.js';

/**
 * 学生の選考メモ（S-10・api.md §2「学生の選考メモ」）
 *
 * - PUT /student-notes/:noteKey … 保存（学生のみ）。本文が空なら削除
 *
 * **読み取りのエンドポイントはここに作らない。** マイページの往復を増やさないため、
 * 読みは GET /selection-flow/me に相乗りしている。
 *
 * ★人事向けの経路も作らない。学生本人にしか見えないことがこの機能の前提で、
 *   覗ける経路を1つでも足すと機能ごと意味を失う。
 */
const router = Router();

/**
 * 対象は常に req.user。クライアントから userId を受け取らない
 * （他人のメモを読み書きできるようにしないため）。
 */
function requireStudent(req, res, next) {
  if (req.user.role !== ROLE.STUDENT) {
    return res.status(403).json({ error: 'forbidden', message: '学生のみ利用できます' });
  }
  next();
}

router.put('/:noteKey', requireAuth, requireStudent, (req, res, next) => {
  try {
    const { noteKey } = req.params;
    if (!STUDENT_NOTE_KEY_VALUES.includes(noteKey)) {
      return res.status(400).json({ error: 'invalid_request', message: 'メモの指定が不正です' });
    }

    const input = req.body?.body;
    if (input !== undefined && input !== null && typeof input !== 'string') {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: 'メモは文字列で指定してください' });
    }

    const body = (input ?? '').trim();
    if (body.length > STUDENT_NOTE_MAX_LENGTH) {
      return res.status(400).json({
        error: 'invalid_request',
        message: `メモは${STUDENT_NOTE_MAX_LENGTH}文字以内で入力してください`,
      });
    }

    res.json({ note: saveNote(db, { studentUserId: req.user.id, noteKey, body }) });
  } catch (error) {
    next(error);
  }
});

export default router;
