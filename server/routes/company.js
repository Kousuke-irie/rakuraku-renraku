import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getCompanyInfo, saveCompanyInfo } from '../services/companyInfo.js';
import { ROLE } from '../../shared/constants.js';

/**
 * 会社情報（P2-10・api.md §2「会社情報」）
 *
 * 参照は**学生を含む全ロール**。学生のトーク画面の会社情報パネルに出すため。
 * 更新は人事（hr / admin）のみ。ロールは JWT 由来の req.user だけで判定し、
 * クライアントから送られた値は信用しない（CLAUDE.md §6-6）。
 */
const router = Router();

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 1000;
const URL_MAX_LENGTH = 500;

/** 採用サイトのリンクとして許可するスキーム。javascript: などを踏ませないため */
const ALLOWED_URL_PROTOCOLS = ['http:', 'https:'];

function requireHr(req, res, next) {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ編集できます' });
  }
  next();
}

function invalidRequest(res, message) {
  return res.status(400).json({ error: 'invalid_request', message });
}

function parseName(value) {
  if (typeof value !== 'string') return null;

  const name = value.trim();
  if (!name || name.length > NAME_MAX_LENGTH) return null;
  return name;
}

/** 紹介文は任意。空文字は「未設定」として null で保存する */
function parseDescription(value) {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };

  const description = value.trim();
  if (description.length > DESCRIPTION_MAX_LENGTH) return { ok: false };
  return { ok: true, value: description || null };
}

/**
 * 採用サイトURLは任意。指定する場合は http / https のみ許可する。
 * `javascript:alert(1)` のようなスキームを学生の画面のリンクに出さないための入口検証。
 */
function parseRecruitSiteUrl(value) {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };

  const raw = value.trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > URL_MAX_LENGTH) return { ok: false };

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false };
  }

  if (!ALLOWED_URL_PROTOCOLS.includes(url.protocol)) return { ok: false };
  return { ok: true, value: url.toString() };
}

router.get('/', requireAuth, (req, res, next) => {
  try {
    res.json({ company: getCompanyInfo(db) });
  } catch (error) {
    next(error);
  }
});

router.put('/', requireAuth, requireHr, (req, res, next) => {
  try {
    const name = parseName(req.body?.name);
    if (name === null) {
      return invalidRequest(res, `会社名は1〜${NAME_MAX_LENGTH}文字で入力してください`);
    }

    const description = parseDescription(req.body?.description);
    if (!description.ok) {
      return invalidRequest(res, `紹介文は${DESCRIPTION_MAX_LENGTH}文字以内で入力してください`);
    }

    const recruitSiteUrl = parseRecruitSiteUrl(req.body?.recruitSiteUrl);
    if (!recruitSiteUrl.ok) {
      return invalidRequest(res, `採用サイトURLは http:// または https:// で始まる${URL_MAX_LENGTH}文字以内のURLで入力してください`);
    }

    const company = saveCompanyInfo(db, {
      name,
      description: description.value,
      recruitSiteUrl: recruitSiteUrl.value,
    });

    res.json({ company });
  } catch (error) {
    next(error);
  }
});

export default router;
