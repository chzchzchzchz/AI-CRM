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
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
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
