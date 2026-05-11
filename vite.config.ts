import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiPort = Number(process.env.PORT || "8787");

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": `http://127.0.0.1:${apiPort}`
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
