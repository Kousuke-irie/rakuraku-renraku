import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createSnippet,
  deleteSnippet,
  listSnippets,
  updateSnippet,
} from '../services/snippets.js';
import { ROLE } from '../../shared/constants.js';

/**
 * 定型文（P2-1・設定画面での管理・api.md §2「メモ・定型文・サマリー」）
 *
 * ルーム非依存の全社共有マスタデータ（database.md §3 snippets）なので
 * ルームメンバー確認は不要。人事のみ参照・編集できればよい。
 */
const router = Router();

/** "/合格" のように "/" で始まり、空白を含まない1トークンであること。
 * ChatPanel 側の絞り込み（先頭が "/" で空白を含まない間だけコマンド扱い）と表記を揃えるため。 */
const COMMAND_PATTERN = /^\/\S+$/;
const COMMAND_MAX_LENGTH = 30;
const TITLE_MAX_LENGTH = 60;
/** 本文の上限。MemoPanel の MEMO_BODY_MAX_LENGTH に合わせる */
const BODY_MAX_LENGTH = 2000;

function requireHr(req, res, next) {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ参照できます' });
  }
  next();
}

function invalidRequest(res, message) {
  return res.status(400).json({ error: 'invalid_request', message });
}

/** command の検証。先頭に "/" が無ければ補う */
function parseCommand(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const command = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (!COMMAND_PATTERN.test(command) || command.length > COMMAND_MAX_LENGTH) return null;
  return command;
}

function parseTitle(value) {
  if (typeof value !== 'string') return null;

  const title = value.trim();
  if (!title || title.length > TITLE_MAX_LENGTH) return null;
  return title;
}

function parseBody(value) {
  if (typeof value !== 'string') return null;

  const body = value.trim();
  if (!body || body.length > BODY_MAX_LENGTH) return null;
  return body;
}

router.get('/', requireAuth, requireHr, (req, res) => {
  res.json({ snippets: listSnippets(db) });
});

router.post('/', requireAuth, requireHr, (req, res, next) => {
  try {
    const command = parseCommand(req.body?.command);
    if (command === null) {
      return invalidRequest(res, `コマンドは「/」で始まる${COMMAND_MAX_LENGTH}文字以内の空白を含まない文字列で入力してください`);
    }

    const title = parseTitle(req.body?.title);
    if (title === null) {
      return invalidRequest(res, `タイトルは1〜${TITLE_MAX_LENGTH}文字で入力してください`);
    }

    const body = parseBody(req.body?.body);
    if (body === null) {
      return invalidRequest(res, `本文は1〜${BODY_MAX_LENGTH}文字で入力してください`);
    }

    const snippet = createSnippet(db, { command, title, body });
    res.status(201).json({ snippet });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, requireHr, (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const hasCommand = req.body?.command !== undefined;
    const hasTitle = req.body?.title !== undefined;
    const hasBody = req.body?.body !== undefined;
    if (!hasCommand && !hasTitle && !hasBody) {
      return invalidRequest(res, '更新する項目がありません');
    }

    let command;
    if (hasCommand) {
      command = parseCommand(req.body.command);
      if (command === null) {
        return invalidRequest(res, `コマンドは「/」で始まる${COMMAND_MAX_LENGTH}文字以内の空白を含まない文字列で入力してください`);
      }
    }

    let title;
    if (hasTitle) {
      title = parseTitle(req.body.title);
      if (title === null) {
        return invalidRequest(res, `タイトルは1〜${TITLE_MAX_LENGTH}文字で入力してください`);
      }
    }

    let body;
    if (hasBody) {
      body = parseBody(req.body.body);
      if (body === null) {
        return invalidRequest(res, `本文は1〜${BODY_MAX_LENGTH}文字で入力してください`);
      }
    }

    const snippet = updateSnippet(db, { id, command, title, body });
    res.json({ snippet });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, requireHr, (req, res, next) => {
  try {
    deleteSnippet(db, Number(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
