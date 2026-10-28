import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createMockContext } from "./test-utils";

/**
 * tools.submitFeedback took a bare `contentId`/`interactionId` and wrote to
 * generatedContent/userInteractions with no ownership check at all — unlike every
 * other per-user mutation in the app (follow-ups.ts, transcriptReports), which scope
 * their write by `and(id, userId)`. Any authenticated user could pass another user's
 * contentId or interactionId and overwrite their userEdits/feedback. Found via an
 * ownership audit of every update()/delete() in the server. Fixed in
 * tools-router.ts's submitFeedback and rag-service.ts's recordFeedback.
 */

const DB = path.join(process.cwd(), "demo-db.test-submit-feedback.json");
const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

async function seedOwnedByUser101() {
  const { getDb } = await import("./db");
  const { generatedContent, userInteractions } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(generatedContent);
  await db.delete(userInteractions);
  await db.insert(generatedContent).values({
    id: 1, userId: 101, contentType: "email", content: "Original content",
    userEdits: null, feedback: null,
  });
  await db.insert(userInteractions).values({
    id: 1, userId: 101, actionType: "ai_chat", feedback: null, feedbackDetails: null,
  });
  return { generatedContent, userInteractions, db };
}

describe("tools.submitFeedback — ownership is enforced", () => {
  it("does not let another user overwrite someone else's generated content", async () => {
    await seedOwnedByUser101();
    const { toolsRouter } = await import("./tools-router");
    const attacker = toolsRouter.createCaller(createMockContext({ id: 999 }) as any);

    await attacker.submitFeedback({
      contentId: 1,
      feedback: "edited",
      editedContent: "attacker-controlled content",
    });

    const { getDb } = await import("./db");
    const { generatedContent } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    const rows = await db.select().from(generatedContent).where(eq(generatedContent.id, 1));
    expect(rows[0].userEdits).toBeNull();
    expect(rows[0].feedback).toBeNull();
  });

  it("does not let another user overwrite someone else's interaction feedback", async () => {
    await seedOwnedByUser101();
    const { toolsRouter } = await import("./tools-router");
    const attacker = toolsRouter.createCaller(createMockContext({ id: 999 }) as any);

    await attacker.submitFeedback({ interactionId: 1, feedback: "negative", details: "attacker note" });

    const { getDb } = await import("./db");
    const { userInteractions } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    const rows = await db.select().from(userInteractions).where(eq(userInteractions.id, 1));
    expect(rows[0].feedback).toBeNull();
    expect(rows[0].feedbackDetails).toBeNull();
  });

  it("still lets the owner edit their own generated content", async () => {
    await seedOwnedByUser101();
    const { toolsRouter } = await import("./tools-router");
    const owner = toolsRouter.createCaller(createMockContext({ id: 101 }) as any);

    await owner.submitFeedback({ contentId: 1, feedback: "edited", editedContent: "my own edit" });

    const { getDb } = await import("./db");
    const { generatedContent } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    const rows = await db.select().from(generatedContent).where(eq(generatedContent.id, 1));
    expect(rows[0].userEdits).toBe("my own edit");
  });
});
