import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
// Built output goes to dashboard public so it is served at /inspector/ in the same app
export default defineConfig({
  plugins: [react()],
  base: "/inspector/",
  server: {
    host: true,
    port: 6274,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    minify: false,
    outDir: path.resolve(__dirname, "../dokploy/public/inspector"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
