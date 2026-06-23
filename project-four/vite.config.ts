import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 本地优先：相对路径打包，便于通过统一入口（/dev/）挂载。开发端口 5183。
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5183 },
});
