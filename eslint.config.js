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
      },
    },
  },
  {
    ignores: ['node_modules', 'dist', 'data'],
  },
];
