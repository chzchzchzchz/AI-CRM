import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { PROCEDURES } from "./mcp-server";

/**
 * Every procedure the MCP server names must exist in appRouter.
 *
 * All six MCP tools called procedures that did not exist. `account.list` when the
 * namespace is `accounts`. `insights.getSummary` when there is no `insights`
 * namespace. `account.search` which never existed anywhere. The server started, listed
 * its tools, advertised itself in the README with a ✅, and failed on every single
 * call — which nobody saw, because nothing in this repository ever called it.
 *
 * A string that names a procedure is not checked by TypeScript. This is the check.
 */

/** Walk the built router and collect every callable path. */
function proceduresIn(router: any, prefix = ""): string[] {
  const out: string[] = [];
  const record = router?._def?.procedures ?? router?._def?.record ?? {};
  for (const [key, value] of Object.entries<any>(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value?._def?.procedures || value?._def?.record) out.push(...proceduresIn(value, path));
    else out.push(path);
  }
  return out;
}

const ALL = proceduresIn(appRouter);

describe("MCP server", () => {
  it("finds the router's procedures at all (guards the walker itself)", () => {
    // If this walker silently returned [], every assertion below would pass on an
    // empty set — the shape of failure this whole file exists to prevent.
    expect(ALL.length).toBeGreaterThan(100);
    expect(ALL).toContain("accounts.list");
  });

  it.each(Object.entries(PROCEDURES))(
    "%s → %s exists in appRouter",
    (_tool, spec) => {
      expect(ALL).toContain(spec.path);
    }
  );

  it("names the right namespace — accounts, not account", () => {
    // The exact mistake: singular where the router is plural.
    for (const spec of Object.values(PROCEDURES)) {
      expect(spec.path).not.toMatch(/^account\./);
      expect(spec.path).not.toMatch(/^insights\./);
    }
  });

  it("declares query or mutation for each, matching the router", () => {
    for (const [tool, spec] of Object.entries(PROCEDURES)) {
      // tRPC v11 keys _def.procedures by the flat dotted path, not by nesting.
      const proc: any = (appRouter as any)._def?.procedures?.[spec.path];
      expect(proc, `${tool}: ${spec.path} not found`).toBeTruthy();

      // Sending a query as a POST is rejected by tRPC, which is what the old client
      // did for every procedure that took an input.
      const type = proc._def?.type ?? (proc._def?.query ? "query" : proc._def?.mutation ? "mutation" : undefined);
      if (type) expect(type, `${tool} (${spec.path})`).toBe(spec.kind);
    }
  });
});
