import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { emailSequences as sequences, EmailSequence } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * OUTREACH SEQUENCES — a reusable cadence: what to send, on which day, through which
 * channel.
 *
 * A sequence is a template, not a campaign. It holds no accounts and sends nothing; it
 * is the shape a rep follows so the fifth touch isn't invented on the fifth day.
 *
 * Ownership is enforced on every read and write. The schema has always had `createdBy`
 * and this router never set it, so `list` returned every user's sequences and `delete`
 * accepted any id from anyone — one rep could remove another's work by guessing a
 * number.
 */

export const STEP_TYPES = ["email", "call", "linkedin", "wait"] as const;

const SequenceStepSchema = z.object({
  id: z.string(),
  type: z.enum(STEP_TYPES),
  /** Days from the start of the sequence. Two steps may share a day. */
  day: z.number().int().min(0).max(365),
  subject: z.string().max(300).optional(),
  content: z.string().max(20_000).optional(),
  notes: z.string().max(2000).optional(),
});

export type SequenceStep = z.infer<typeof SequenceStepSchema>;

/** Steps arrive in whatever order the UI held them; storage is always day-ordered. */
export function orderSteps(steps: SequenceStep[]): SequenceStep[] {
  return [...steps].sort((a, b) => a.day - b.day);
}

/**
 * How long the cadence runs and what it is made of. Derived rather than stored, so it
 * cannot drift from the steps it describes.
 */
export function summarise(steps: SequenceStep[]) {
  const byType: Record<string, number> = {};
  for (const s of steps) byType[s.type] = (byType[s.type] ?? 0) + 1;
  return {
    stepCount: steps.length,
    durationDays: steps.length ? Math.max(...steps.map((s) => s.day)) : 0,
    byType,
    /** A step with no content is a step a rep will have to write on the day. */
    incomplete: steps.filter((s) => s.type !== "wait" && !s.content?.trim()).length,
  };
}

function parseSteps(raw: unknown): SequenceStep[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? (parsed as SequenceStep[]) : [];
  } catch {
    return [];
  }
}

export const sequencesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const rows: EmailSequence[] = await db
      .select()
      .from(sequences)
      .where(eq(sequences.createdBy, ctx.user.id));

    return rows
      .map((seq) => {
        const steps = orderSteps(parseSteps(seq.steps));
        return {
          id: seq.id,
          name: seq.name,
          description: seq.description ?? null,
          isActive: seq.isActive ?? true,
          steps,
          summary: summarise(steps),
          updatedAt: seq.updatedAt,
          createdAt: seq.createdAt,
        };
      })
      // Most recently touched first — the one you were just working on.
      .sort((a, b) => new Date(b.updatedAt as any).getTime() - new Date(a.updatedAt as any).getTime());
  }),

  save: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        steps: z.array(SequenceStepSchema).max(50),
        id: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const stepsJson = JSON.stringify(orderSteps(input.steps));

      if (input.id) {
        // Scoped to the owner: an id alone must not be enough to overwrite a sequence.
        const existing: EmailSequence[] = await db
          .select()
          .from(sequences)
          .where(and(eq(sequences.id, input.id), eq(sequences.createdBy, ctx.user.id)))
          .limit(1);
        if (!existing[0]) throw new Error("Sequence not found");

        await db
          .update(sequences)
          .set({
            name: input.name,
            description: input.description ?? null,
            steps: stepsJson,
            updatedAt: new Date(),
          })
          .where(eq(sequences.id, input.id));

        return { id: input.id, name: input.name };
      }

      const result = await db.insert(sequences).values({
        name: input.name,
        description: input.description ?? null,
        steps: stepsJson,
        createdBy: ctx.user.id,
      });

      return { id: Number(result?.[0]?.insertId ?? 0), name: input.name };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows: EmailSequence[] = await db
        .select()
        .from(sequences)
        .where(and(eq(sequences.id, input.id), eq(sequences.createdBy, ctx.user.id)))
        .limit(1);
      const source = rows[0];
      if (!source) throw new Error("Sequence not found");

      // Copying a working cadence and changing two lines is how a second one gets
      // written; starting from an empty builder is how it doesn't.
      const result = await db.insert(sequences).values({
        name: `${source.name} (copy)`,
        description: source.description ?? null,
        steps: typeof source.steps === "string" ? source.steps : JSON.stringify(source.steps),
        createdBy: ctx.user.id,
      });

      return { id: Number(result?.[0]?.insertId ?? 0) };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(sequences)
        .where(and(eq(sequences.id, input.id), eq(sequences.createdBy, ctx.user.id)));

      return { success: true };
    }),
});
