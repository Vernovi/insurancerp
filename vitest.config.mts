import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "node", testTimeout: 120000, hookTimeout: 120000, fileParallelism: false },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/empty.ts"),
    },
  },
});
