import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    // API サーバ（server/index.js）が 3000 を使うため client は 5173（CLAUDE.md §5）
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // Socket.IO は必ず server/index.js の HTTP サーバへ流す（CLAUDE.md §6-4）。
      // ws: true が無いと WebSocket へのアップグレードが proxy されず、
      // ハンドシェイク時の JWT 検証（server/sockets/index.js）を通らない。
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
