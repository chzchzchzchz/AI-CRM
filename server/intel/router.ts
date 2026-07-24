import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { generateAccountBrief, getAccountBriefHistory } from "./brief";
import { gatherAccountSignals } from "./signals";
import { getBrainDigest, learnCycle } from "./brain";

/**
 * Account intelligence surface.
 *
 * `accountBrief` is the consolidated read — deterministic facts plus validated judgement.
 * `accountSignals` exposes the same underlying SignalPack raw, so the UI (or an
 * integration) can build its own view without going through a model at all.
 * `briefHistory` returns prior generations with per-metric deltas.
 */
export const intelRouter = router({
  accountBrief: protectedProcedure
    .input(z.object({ accountId: z.number(), forceRefresh: z.boolean().optional() }))
    .query(async ({ input }) => {
      const brief = await generateAccountBrief(input.accountId, {
        forceRefresh: input.forceRefresh,
      });
      return {
        accountId: brief.accountId,
        accountName: brief.accountName,
        markdown: brief.markdown,
        metrics: brief.metrics,
        signals: brief.signals,
        signalHash: brief.signalHash,
        version: brief.version,
        generatedAt: brief.generatedAt,
        cached: brief.cached,
        degraded: brief.degraded,
        droppedClaims: brief.validation.dropped,
      };
    }),

  accountSignals: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => gatherAccountSignals(input.accountId)),

  briefHistory: protectedProcedure
    .input(z.object({ accountId: z.number(), limit: z.number().min(1).max(50).optional() }))
    .query(async ({ input }) => getAccountBriefHistory(input.accountId, input.limit ?? 10)),

  /**
   * The Company Brain: verified portfolio snapshot + the lessons the model has accumulated
   * across learning cycles. Reads are instant (in-memory digest); a background learning
   * cycle is scheduled automatically when the underlying data has changed.
   */
  brain: protectedProcedure.query(async () => getBrainDigest()),

  /** Force a learning cycle now (admin/debug — normally runs in the background). */
  brainLearn: protectedProcedure.mutation(async () => learnCycle(true)),
});
