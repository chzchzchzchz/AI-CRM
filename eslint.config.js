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
      // that renders fine and behaves wrong. This was a warning while the existing
      // omissions awaited review, and the review found one of seven was real: the
      // accounts list left the territory predicate out of its dependencies, so picking
      // a rep changed nothing on screen. The warning had sat in every lint run for
      // weeks. A new omission of the same kind then showed "0 accounts" under a tile
      // that said 69, and was caught only by someone reading the lint output. The
      // other six were harmless and are fixed, so this is an error now: a missing
      // dependency fails the build instead of scrolling past.
      "react-hooks/exhaustive-deps": "error",
    },
  },
];
