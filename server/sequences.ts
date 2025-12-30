import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { emailSequences as sequences } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const SequenceStepSchema = z.object({
  id: z.string(),
  type: z.enum(["email", "call", "linkedin", "wait"]),
  day: z.number(),
  subject: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
});

export const sequencesRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    
    const allSequences = await db.select().from(sequences).orderBy(sequences.updatedAt);
    
    return allSequences.map(seq => ({
      ...seq,
      steps: typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps
    }));
  }),

  save: publicProcedure
    .input(z.object({
      name: z.string(),
      steps: z.array(SequenceStepSchema),
      id: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const stepsJson = JSON.stringify(input.steps);

      if (input.id) {
        // Update existing
        await db.update(sequences)
          .set({
            name: input.name,
            steps: stepsJson,
            updatedAt: new Date(),
          })
          .where(eq(sequences.id, input.id));
        
        return { id: input.id, name: input.name };
      } else {
        // Create new
        const result = await db.insert(sequences).values({
          name: input.name,
          steps: stepsJson,
        });
        
        return { id: result[0].insertId, name: input.name };
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(sequences).where(eq(sequences.id, input.id));
      
      return { success: true };
    }),
});
