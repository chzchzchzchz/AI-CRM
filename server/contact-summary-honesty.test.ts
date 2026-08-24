import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * generateContactSummary returned a bare string, so when no model was reachable it
 * returned LLM_UNAVAILABLE_NOTE as an ordinary, successful-looking summary — no
 * `available` flag existed for a caller to check even in principle. ContactDetail.tsx
 * read the resolved string, toasted "AI summary generated from LinkedIn!", and filled
 * the summary panel with the apology text as if it were an analysis. Every other
 * generator in this codebase (outreach.generateEmail, outreach.refineEmail) already
 * reports this as { content, available }; this one didn't.
 */

const DB = path.join(process.cwd(), "demo-db.test-contact-summary.json");
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.doUnmock("./_core/llm");
  vi.resetModules();
});

async function seedContact(id: number) {
  const { getDb } = await import("./db");
  const { contacts } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.insert(contacts).values({
    id, name: "Jordan Bailey", title: "VP Engineering", email: "jordan@example.com",
  });
}

describe("generateContactSummary — model-availability honesty", () => {
  it("reports available:false and does not present the degradation note as a summary", async () => {
    await seedContact(701);

    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{ message: { role: "assistant", content: actual.LLM_UNAVAILABLE_NOTE } }],
        }),
      };
    });

    const { generateContactSummary } = await import("./aiContext");
    const result = await generateContactSummary(701, false);

    expect(result.available).toBe(false);
    expect(result.content).toContain("AI generation is unavailable");
  });

  it("reports available:true with the real summary when the model responds", async () => {
    await seedContact(702);

    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{ message: { role: "assistant", content: "Jordan is a hands-on VP Engineering leader..." } }],
        }),
      };
    });

    const { generateContactSummary } = await import("./aiContext");
    const result = await generateContactSummary(702, false);

    expect(result.available).toBe(true);
    expect(result.content).toContain("Jordan is a hands-on VP Engineering leader");
  });

  it("reports available:false for a contact that does not exist, not a crash or a fake summary", async () => {
    const { generateContactSummary } = await import("./aiContext");
    const result = await generateContactSummary(999999, false);

    expect(result.available).toBe(false);
    expect(result.content).toBe("Contact not found");
  });
});
