import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // shared/ is in here because a test file outside the include glob is silently
    // never run — it reports green by not existing. check-claims asserts that every
    // *.test.ts in the repo is matched by one of these patterns.
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "shared/**/*.test.ts",
      "shared/**/*.spec.ts",
    ],
    // The demo/JSON database is a single shared file on disk (demo-db.json).
    // Running test files in parallel races on writes to it and causes flaky
    // failures (e.g. audit-log assertions). Force sequential file execution.
    fileParallelism: false,
    env: {
      // Tests create accounts, calls and intent scores. Without this they write into the
      // demo dataset the product ships with — polluting an account's intent history and
      // call list, which silently corrupts the briefs built from those signals.
      DEMO_DB_PATH: path.resolve(templateRoot, "demo-db.test.json"),
    },
  },
});
