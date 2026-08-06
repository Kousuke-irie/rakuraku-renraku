import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import {
  buildStudentFlow,
  listSelectionSteps,
  saveSelectionSteps,
} from '../services/selectionFlow.js';
import {
  ROLE,
  SELECTION_FLOW_STEP_VALUES,
  SELECTION_STEP_LABEL_MAX_LENGTH,
  SELECTION_STEP_TEXT_MAX_LENGTH,
} from '../../shared/constants.js';

/**
 * 選考フロー（P2-11 / S-09・api.md §2「選考フロー」）
 *
 * - GET  /selection-flow      … ステップ設定（全ロール）
 * - PUT  /selection-flow      … 一括更新（人事のみ）
 * - GET  /selection-flow/me   … 学生本人の進捗＋見せてよいFB（学生のみ）
 *
 * 学生ごとのフィードバックは routes/students.js に置く。
 * あちらは「人事ロール」＋「その学生のルームの room_members」の二段構えの認可を
 * 既に持っており、それを再実装しないため。
 */
const router = Router();

function requireHr(req, res, next) {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ編集できます' });
  }
  next();
}

function invalidRequest(res, message) {
  return res.status(400).json({ error: 'invalid_request', message });
}

/** 任意のテキスト。空文字は「未設定」として null にする */
function parseOptionalText(value, maxLength) {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };

  const text = value.trim();
  if (text.length > maxLength) return { ok: false };
  return { ok: true, value: text || null };
}

/**
 * PUT /selection-flow のボディ検証。
 * 全ステップを1回で受け取り、欠けや重複があれば弾く（部分更新を許すと並び順が壊れる）。
 */
function parseSteps(input) {
  if (!Array.isArray(input)) return { error: 'steps は配列で指定してください' };
  if (input.length !== SELECTION_FLOW_STEP_VALUES.length) {
    return { error: `steps は${SELECTION_FLOW_STEP_VALUES.length}件すべてを指定してください` };
  }

  const seen = new Set();
  const steps = [];

  for (const item of input) {
    const statusKey = item?.statusKey;
    if (!SELECTION_FLOW_STEP_VALUES.includes(statusKey)) {
      return { error: '選考ステップの指定が不正です' };
    }
    if (seen.has(statusKey)) return { error: '選考ステップが重複しています' };
    seen.add(statusKey);

    const sortOrder = Number(item?.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return { error: '並び順は0以上の整数で指定してください' };
    }

    const label = parseOptionalText(item?.label, SELECTION_STEP_LABEL_MAX_LENGTH);
    if (!label.ok) return { error: `表示名は${SELECTION_STEP_LABEL_MAX_LENGTH}文字以内で入力してください` };

    const description = parseOptionalText(item?.description, SELECTION_STEP_TEXT_MAX_LENGTH);
    if (!description.ok) return { error: `説明は${SELECTION_STEP_TEXT_MAX_LENGTH}文字以内で入力してください` };

    const points = parseOptionalText(item?.points, SELECTION_STEP_TEXT_MAX_LENGTH);
    if (!points.ok) return { error: `ポイントは${SELECTION_STEP_TEXT_MAX_LENGTH}文字以内で入力してください` };

    steps.push({
      statusKey,
      isEnabled: Boolean(item?.isEnabled),
      sortOrder,
      label: label.value,
      description: description.value,
      points: points.value,
    });
  }

  // 有効なステップが1つも無いとフローが描けない。学生の画面が空になるのを防ぐ
  if (!steps.some((step) => step.isEnabled)) {
    return { error: '少なくとも1つのステップを有効にしてください' };
  }

  return { steps };
}

router.get('/', requireAuth, (req, res, next) => {
  try {
    res.json({ steps: listSelectionSteps(db) });
  } catch (error) {
    next(error);
  }
});

router.put('/', requireAuth, requireHr, (req, res, next) => {
  try {
    const parsed = parseSteps(req.body?.steps);
    if (parsed.error) return invalidRequest(res, parsed.error);

    res.json({ steps: saveSelectionSteps(db, parsed.steps) });
  } catch (error) {
    next(error);
  }
});

/**
 * 学生本人の進捗。対象は req.user から引き、クライアントの userId は受け取らない
 * （他人の選考状況を覗けるようにしないため）。
 */
router.get('/me', requireAuth, (req, res, next) => {
  try {
    if (req.user.role !== ROLE.STUDENT) {
      return res.status(403).json({ error: 'forbidden', message: '学生のみ参照できます' });
    }

    res.json(buildStudentFlow(db, req.user.id));
  } catch (error) {
    next(error);
  }
});

export default router;
