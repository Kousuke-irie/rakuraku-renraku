// 面接アンケートの人事向け参照（S-11）。
//
// ★このルーターは学生に一切出さない（requireHr が弾く）。
// ★逆に、人事にも「誰が回答したか」は出さない。匿名化は services 側で完結して
//   おり、ここで生データに触らないこと（interviewSurveys.js のコメント参照）。
//
// エンドポイントを3本に割っているのは、匿名性の下限（回答が少ない面接官の
// 自由記述を出さない）を**サーバ側の1箇所**で効かせるため。全件を1回で返して
// 画面でドロップダウン絞り込みをすると、通信内容の時点で下限が破れている。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth, requireHr } from '../middleware/auth.js';
import { buildInterviewSurveyView, listComments } from '../services/interviewSurveys.js';
import { generateInterviewSurveySummary } from '../services/interviewSurveyAi.js';
import {
  INTERVIEW_SURVEY_SCOPE_ALL,
  INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_ID,
} from '../../shared/constants.js';

const router = Router();

/**
 * `?interviewerId=` を読む。'all'（既定）／面接官ID／'unknown'。
 * 実在しないIDでも 400 にはしない（回答0件として扱われ、伏せられるだけ）。
 */
function parseScopeId(raw) {
  if (raw === undefined || raw === '') return { scopeId: INTERVIEW_SURVEY_SCOPE_ALL };
  if (raw === INTERVIEW_SURVEY_SCOPE_ALL || raw === INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_ID) {
    return { scopeId: raw };
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { error: '面接官の指定が不正です' };
  return { scopeId: String(id) };
}

/** GET /interview-surveys → 面接官別の★集計（自由記述は含まない） */
router.get('/', requireAuth, requireHr, (req, res, next) => {
  try {
    res.json(buildInterviewSurveyView(db));
  } catch (error) {
    next(error);
  }
});

/** GET /interview-surveys/comments?interviewerId= → 匿名化した自由記述 */
router.get('/comments', requireAuth, requireHr, (req, res, next) => {
  try {
    const parsed = parseScopeId(req.query.interviewerId);
    if (parsed.error) {
      return res.status(400).json({ error: 'invalid_query', message: parsed.error });
    }

    return res.json(listComments(db, parsed.scopeId));
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /interview-surveys/ai-summary?interviewerId= → 自由記述のAI要約。
 *
 * 生成を待って返す。AI 現況サマリー（P3-1a）と違い Socket.IO で後追い配信しない
 * ——スコープを切り替えるたびに配信先を管理する必要が出て、得るものより複雑になる。
 * 失敗しても原文リストは別エンドポイントで既に出ているので画面は壊れない。
 */
router.get('/ai-summary', requireAuth, requireHr, async (req, res, next) => {
  try {
    const parsed = parseScopeId(req.query.interviewerId);
    if (parsed.error) {
      return res.status(400).json({ error: 'invalid_query', message: parsed.error });
    }

    const force = req.query.force === '1';
    return res.json(await generateInterviewSurveySummary(db, { scopeId: parsed.scopeId, force }));
  } catch (error) {
    return next(error);
  }
});

export default router;
