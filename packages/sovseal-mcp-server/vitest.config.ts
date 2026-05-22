import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,ts}"],
    exclude: ["node_modules", "dist", "src/__tests__/bench-v2.test.ts"],
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
