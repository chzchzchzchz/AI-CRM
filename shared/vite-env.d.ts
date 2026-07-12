// Ambient types for Vite's `import.meta.env`, used by isomorphic code under shared/
// (e.g. getLoginUrl in shared/const.ts). Committed so `tsc --noEmit` types it
// consistently everywhere, including CI — the server tsconfig has no vite/client types.
interface ImportMetaEnv {
  // Values are strings at runtime; typed loosely to stay compatible with all callers.
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
