import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 纯本地桌面应用：相对路径打包，便于后续用 Tauri/Electron 直接加载本地文件。
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5180 },
});
