import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Deliberately narrow.
 *
 * This is not a style config — Prettier owns formatting and TypeScript owns types.
 * It exists for one class of bug that both of those miss entirely and that cost
 * real time in this repo: a hook placed below a component's early return.
 *
 * That mistake typechecks clean, builds clean, passes every unit test, and then
 * renders a blank page with "Rendered more hooks than during the previous render".
 * It happened twice while paginating the accounts list, and both times the only
 * thing that caught it was loading the page in a browser.
 *
 * Adding broad stylistic rules to a codebase this size would produce hundreds of
 * warnings nobody reads, which is how a linter stops being a signal. Every rule
 * here is an error, and every rule here has drawn blood.
 */
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "drizzle/**",
      "scripts/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  {
    files: ["client/src/**/*.{ts,tsx}"],
    languageOptions: {
      // TypeScript parser, without type-aware linting: the rules here are purely
      // syntactic, and a full type-check program would double CI time for no gain.
      parser: tseslint.parser,
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // The one that matters: hooks must be unconditional and above every return.
      "react-hooks/rules-of-hooks": "error",
      // A stale closure reading last render's state is the other bug in this family
      // that renders fine and behaves wrong. Warn rather than error — the existing
      // code has several deliberate omissions that would need review, not a blanket fix.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
