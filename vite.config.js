import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import socketIoPlugin from "./plugins/socket.io.plugin";
import socketEvents from "./socket_event";

export default defineConfig({
  plugins: [vue(), socketIoPlugin({ socketEvents })],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
  },
});
