import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import socketIoPlugin from "./plugins/socket.io.plugin";
import socketEvents from "./socket_event";

export default defineConfig({
  plugins: [vue(), socketIoPlugin({ socketEvents })],
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
      // NOTE: /socket.io はサンプルの socketIoPlugin が Vite dev サーバ上で
      // 処理しているため、まだ proxy しない。プラグイン撤去（A-2）と同時に
      // { target: "http://localhost:3000", ws: true } を追加すること。
    },
  },
});
