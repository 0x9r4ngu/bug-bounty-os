import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: "client",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "client/src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5177",
    },
  },
});
