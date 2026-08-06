import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        // crypto.randomUUID()（clientMsgId の生成）。Node 20+ とブラウザの両方で使える
        crypto: 'readonly',
        // ドロップダウンの「外側クリック」「Escape」検知と開く向きの判定（HandlingStatusMenu）
        document: 'readonly',
        window: 'readonly',
        // 受信箱3ペインの幅の追従（InboxView・ドラッグの上限計算）
        ResizeObserver: 'readonly',
        // 企業からのFBの既読状態（useFeedbackReads）。
        // ★認証情報は保存しないこと（frontend.md §10-5）。ここに置いてよいのは
        //   漏れても害が無く、端末ごとに違ってよいものだけ
        localStorage: 'readonly',
        // 採用サイトURLのスキーム検証（routes/company.js）。Node 20+ とブラウザの両方で使える
        URL: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules', 'dist', 'data'],
  },
];
