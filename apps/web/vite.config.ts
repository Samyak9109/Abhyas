import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("pdfjs-dist")) {
            return "pdfjs";
          }
          if (id.includes("mammoth")) {
            return "mammoth";
          }
          if (id.includes("react") && (id.includes("react-dom") || id.includes("react/"))) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
