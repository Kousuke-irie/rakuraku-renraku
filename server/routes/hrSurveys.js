// 人事FBアンケートの人事向け参照（S-12）。
//
// ★このルーターは学生に一切出さない（requireHr が弾く）。
// ★逆に、人事にも「誰が回答したか」は出さない。匿名化は services 側で完結して
//   おり、ここで生データに触らないこと（hrSurveys.js のコメント参照）。
//
// エンドポイントを3本に割っているのは、匿名性の下限（回答が少ない担当者の
// 自由記述を出さない）を**サーバ側の1箇所**で効かせるため。全件を1回で返して
// 画面でドロップダウン絞り込みをすると、通信内容の時点で下限が破れている。
// 分け方は routes/interviewSurveys.js（S-11）と揃えている。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth, requireHr } from '../middleware/auth.js';
import { buildHrSurveyView, listHrSurveyComments } from '../services/hrSurveys.js';
import { generateHrSurveySummary } from '../services/hrSurveyAi.js';
import {
  HR_SURVEY_SCOPE_ALL,
  HR_SURVEY_UNKNOWN_ASSIGNEE_ID,
} from '../../shared/constants.js';

const router = Router();

/**
 * `?assigneeId=` を読む。'all'（既定）／担当者ID／'unknown'。
 * 実在しないIDでも 400 にはしない（回答0件として扱われ、伏せられるだけ）。
 */
function parseScopeId(raw) {
  if (raw === undefined || raw === '') return { scopeId: HR_SURVEY_SCOPE_ALL };
  if (raw === HR_SURVEY_SCOPE_ALL || raw === HR_SURVEY_UNKNOWN_ASSIGNEE_ID) {
    return { scopeId: raw };
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { error: '担当者の指定が不正です' };
  return { scopeId: String(id) };
}

/** GET /hr-surveys → 担当者別の★集計（自由記述は含まない） */
router.get('/', requireAuth, requireHr, (req, res, next) => {
  try {
    res.json(buildHrSurveyView(db));
  } catch (error) {
    next(error);
  }
});

/** GET /hr-surveys/comments?assigneeId= → 匿名化した自由記述 */
router.get('/comments', requireAuth, requireHr, (req, res, next) => {
  try {
    const parsed = parseScopeId(req.query.assigneeId);
    if (parsed.error) {
      return res.status(400).json({ error: 'invalid_query', message: parsed.error });
    }

    return res.json(listHrSurveyComments(db, parsed.scopeId));
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /hr-surveys/ai-summary?assigneeId= → 自由記述のAI要約。
 *
 * 生成を待って返す。失敗しても原文リストは別エンドポイントで既に出ているので
 * 画面は壊れない（S-11 と同じ方針）。
 */
router.get('/ai-summary', requireAuth, requireHr, async (req, res, next) => {
  try {
    const parsed = parseScopeId(req.query.assigneeId);
    if (parsed.error) {
      return res.status(400).json({ error: 'invalid_query', message: parsed.error });
    }

    const force = req.query.force === '1';
    return res.json(await generateHrSurveySummary(db, { scopeId: parsed.scopeId, force }));
  } catch (error) {
    return next(error);
  }
});

export default router;
