/**
 * How many rows a write actually touched, whichever store ran it.
 *
 * Real mysql2 resolves `db.update(...)` / `db.delete(...)` to a `[ResultSetHeader, ...]`
 * tuple; the demo-mode JSON shim resolves to a plain `{ affectedRows }` object. Neither
 * shape survives being read the other way — destructuring the shim's result as a tuple
 * throws, and reading `.affectedRows` off the real tuple reads it off an array.
 *
 * This existed as a private helper in admin-router.ts, where an unchecked UPDATE was
 * reporting `{ success: true }` for a userId that matched nothing — confirmed live with
 * id 999999999 and id -1. It is shared now because that is not a property of the admin
 * router: any write whose WHERE can miss has the same failure available to it, and org
 * scoping made missing MORE likely, not less. A cross-tenant id is now a legitimate
 * zero-row write, and "we updated it" must not be the answer to one.
 */
export function affectedRows(result: unknown): number {
  const row = Array.isArray(result) ? result[0] : result;
  return (row as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}
