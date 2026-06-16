import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 本地优先：相对路径打包，便于后续 Tauri/Electron 直接加载。端口 5181（避免与 project-one 冲突）。
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5181 },
});
