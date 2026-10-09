import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // base: '/retail/debit-card/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/public": path.resolve(__dirname, "./public"),
    },
  },
  server: {
    port: 3000,
    fs: {
      strict: false,
    },
    proxy: {
      "/api": {
        target: `https://localhost:${process.env.PORT || 3000}`,
        // changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
