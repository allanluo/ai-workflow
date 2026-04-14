import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/llm/generate': {
        target: 'http://10.0.0.20:8001',
        changeOrigin: true,
      },
    },
  },
});

