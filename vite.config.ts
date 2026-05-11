import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { parsePort } from "./server/config.js";

const apiPort = parsePort(process.env.PORT);

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
