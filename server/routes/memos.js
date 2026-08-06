import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { assertRoomMember } from '../services/roomAuth.js';
import { emitMemoUpdated } from '../services/realtime.js';
import {
  createMemo,
  deleteMemo,
  listMemos,
  updateMemo,
} from '../services/memos.js';
import { MEMO_SCOPE, MEMO_SCOPE_VALUES, ROLE } from '../../shared/constants.js';

/**
 * 申し送りメモ（P2-5 / P2-6・api.md §2「メモ・定型文・サマリー」）
 *
 * `/rooms/:id/memos` と `/memos/:id` の両方を持つため、routes/index.js では
 * プレフィックスを付けずにマウントし、ここでフルパスを定義する。
 *
 * 認可は二段構え:
 *   1. そのルームの room_members か（assertRoomMember）
 *   2. **人事ロールか**（requireHr）
 * 学生も自分のルームの room_members に含まれるので、2 が無いと
 * 自分に関する申し送りメモを読めてしまう。メモは人事の社内情報なので必ず両方を通す。
 */
const router = Router();

/** 本文の上限。textarea の入力事故でDBを膨らませないための実用上の制限 */
const MEMO_BODY_MAX_LENGTH = 2000;

function requireHr(req, res, next) {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ参照できます' });
  }
  next();
}

/** 本文の検証。空文字・空白のみ・長すぎを弾き、前後の空白を落とした文字列を返す */
function parseBody(value) {
  if (typeof value !== 'string') return null;

  const body = value.trim();
  if (!body || body.length > MEMO_BODY_MAX_LENGTH) return null;
  return body;
}

function invalidRequest(res, message) {
  return res.status(400).json({ error: 'invalid_request', message });
}

/** 共有メモだけをリアルタイム配信する（個人メモを他の人事に流さない・api.md §3） */
async function broadcastIfShared(req, memo) {
  if (memo.scope !== MEMO_SCOPE.SHARED) return;
  emitMemoUpdated(req.app.get('io'), memo);
}

router.get('/rooms/:id/memos', requireAuth, requireHr, (req, res) => {
  const roomId = Number(req.params.id);
  assertRoomMember(db, req.user.id, roomId);

  res.json({ memos: listMemos(db, { roomId, userId: req.user.id }) });
});

router.post('/rooms/:id/memos', requireAuth, requireHr, async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    assertRoomMember(db, req.user.id, roomId);

    const body = parseBody(req.body?.body);
    if (body === null) {
      return invalidRequest(res, `メモは1〜${MEMO_BODY_MAX_LENGTH}文字で入力してください`);
    }

    const scope = req.body?.scope ?? MEMO_SCOPE.PRIVATE;
    if (!MEMO_SCOPE_VALUES.includes(scope)) {
      return invalidRequest(res, 'メモの公開範囲が不正です');
    }

    const memo = createMemo(db, { roomId, authorId: req.user.id, body, scope });
    await broadcastIfShared(req, memo);

    res.status(201).json({ memo });
  } catch (error) {
    next(error);
  }
});

// 本文更新と scope の共有昇格（P2-6）を兼ねる。
router.patch('/memos/:id', requireAuth, requireHr, async (req, res, next) => {
  try {
    const memoId = Number(req.params.id);

    const hasBody = req.body?.body !== undefined;
    const hasScope = req.body?.scope !== undefined;
    if (!hasBody && !hasScope) {
      return invalidRequest(res, '更新する項目がありません');
    }

    let body;
    if (hasBody) {
      body = parseBody(req.body.body);
      if (body === null) {
        return invalidRequest(res, `メモは1〜${MEMO_BODY_MAX_LENGTH}文字で入力してください`);
      }
    }

    if (hasScope && !MEMO_SCOPE_VALUES.includes(req.body.scope)) {
      return invalidRequest(res, 'メモの公開範囲が不正です');
    }

    // 更新対象のルームに所属しているかを、メモの実データ側から検証する
    // （クライアントから送られた roomId を信用しない・CLAUDE.md §6-6）。
    const target = db.prepare('SELECT room_id AS roomId FROM memos WHERE id = ?').get(memoId);
    if (!target) {
      return res.status(404).json({ error: 'not_found', message: 'メモが存在しません' });
    }
    assertRoomMember(db, req.user.id, target.roomId);

    const memo = updateMemo(db, {
      memoId,
      userId: req.user.id,
      body,
      scope: hasScope ? req.body.scope : undefined,
    });
    await broadcastIfShared(req, memo);

    res.json({ memo });
  } catch (error) {
    next(error);
  }
});

// 削除は物理削除（memos に deleted_at が無いため）。
// 削除の socket イベントは api.md §3 に定義が無いので配信しない。
// 他の人事の画面には次回の GET /rooms/:id/memos で反映される。
router.delete('/memos/:id', requireAuth, requireHr, (req, res) => {
  const memoId = Number(req.params.id);

  const target = db.prepare('SELECT room_id AS roomId FROM memos WHERE id = ?').get(memoId);
  if (!target) {
    return res.status(404).json({ error: 'not_found', message: 'メモが存在しません' });
  }
  assertRoomMember(db, req.user.id, target.roomId);

  deleteMemo(db, { memoId, userId: req.user.id });
  res.status(204).end();
});

export default router;
