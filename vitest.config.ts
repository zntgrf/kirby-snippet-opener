import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/unit/**/*.test.ts"],
    typecheck: {
      tsconfig: "./tsconfig.vitest.json",
    },
  },
});
