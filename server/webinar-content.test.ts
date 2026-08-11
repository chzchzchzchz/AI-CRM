import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * The webinar generator takes free text a rep pastes in and hands it to a model. Three
 * things went wrong here and each is guarded below:
 *
 *  - the input was unbounded, so an accidental paste of a whole document became an
 *    expensive, slow prompt;
 *  - the catch block flattened every failure into "Failed to generate webinar content",
 *    so an unset API key was indistinguishable from malformed model output and the UI
 *    told the user to "try again" — advice that cannot work for a config problem;
 *  - a second, unwired copy of this procedure briefly existed in outreach.ts, which is
 *    how the two would have drifted.
 */
function ctx(): TrpcContext {
  return {
    user: {
      id: 1, openId: "t", email: "demo@ai-crm.com", name: "T", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("webinar content generation", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "true";
    // Force the unavailable path: no hosted key, unreachable local model, short deadline.
    process.env.OPENROUTER_API_KEY = "";
    process.env.LOCAL_LLM_URL = "http://127.0.0.1:1";
    process.env.LLM_TOTAL_DEADLINE_MS = "2000";
    process.env.LLM_REQUEST_TIMEOUT_MS = "2000";
  });

  it("rejects an oversized paste instead of sending it to the model", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(
      caller.tools.generateWebinarContent({ contentAssets: "x".repeat(50_000) } as any)
    ).rejects.toThrow();
  });

  it("rejects empty input", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(
      caller.tools.generateWebinarContent({ contentAssets: "" } as any)
    ).rejects.toThrow();
  });

  it("names the remedy when no model is configured, rather than a generic failure", async () => {
    const caller = appRouter.createCaller(ctx());
    let message = "";
    try {
      await caller.tools.generateWebinarContent({
        contentAssets: "Webinar: Zero Trust for mid-market. 30 minutes, live demo.",
      } as any);
    } catch (e: any) {
      message = String(e?.message ?? "");
    }
    expect(message).not.toMatch(/^Failed to generate webinar content$/);
    expect(message).toMatch(/not configured/i);
    expect(message).toMatch(/OPENROUTER_API_KEY|ollama/i);
  }, 20_000);

  it("defines the procedure exactly once", async () => {
    // The duplicate lived in outreach.ts and nothing called it; the wired copy is in
    // tools-router. Two copies of a prompt drift, and only one of them gets the fix.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname);
    const hits: string[] = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".ts") || f.includes(".test.")) continue;
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      if (/generateWebinarContent\s*:\s*(protected|public)Procedure/.test(src)) hits.push(f);
    }
    expect(hits).toEqual(["tools-router.ts"]);
  });
});
