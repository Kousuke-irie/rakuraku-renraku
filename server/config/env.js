// 環境変数の単一の情報源。process.env を各ファイルで直接読まず、ここから import する。
//
// 起動時に必須値を検証する理由：JWT_SECRET が空だと jwt.sign が例外を投げ、
// ログインが「500 の HTML」で失敗する。クライアントは message を読めず
// 「IDまたはパスワードが正しくありません」と表示するため、設定ミスが
// 認証情報の誤りに見えてしまう（切り分けに時間を取られる）。

const REQUIRED_KEYS = ['JWT_SECRET'];

const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `環境変数が未設定です: ${missing.join(', ')}\n` +
      '.env.example をコピーして .env を作成し、値を設定してください。\n' +
      'JWT_SECRET の生成例: node -e "console.log(require(\'node:crypto\').randomBytes(48).toString(\'base64url\'))"'
  );
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const PORT = Number(process.env.PORT) || 3000;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
