import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { generateAccountBrief, getAccountBriefHistory } from "./brief";
import { createAccountBriefHandoff, loadBoundaryAttestPrivateKey } from "./boundary-attest";
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
    .query(async ({ input, ctx }) => {
      const brief = await generateAccountBrief(ctx.orgId, input.accountId, {
        forceRefresh: input.forceRefresh,
      });
      return {
        accountId: brief.accountId,
        accountName: brief.accountName,
        markdown: brief.markdown,
        judgement: brief.judgement,
        metrics: brief.metrics,
        signals: brief.signals,
        signalHash: brief.signalHash,
        version: brief.version,
        generatedAt: brief.generatedAt,
        cached: brief.cached,
        degraded: brief.degraded,
        degradedReason: brief.degradedReason,
        droppedClaims: brief.validation.dropped,
      };
    }),

  /**
   * Explicit cross-boundary export. Normal accountBrief reads never sign anything.
   * The returned artifact string is the exact byte representation bound by the receipt.
   */
  accountBriefHandoff: protectedProcedure
    .input(z.object({ accountId: z.number(), forceRefresh: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      let privateKeyPem: string;
      try {
        privateKeyPem = loadBoundaryAttestPrivateKey();
      } catch (error) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "BoundaryAttest signing is not configured.",
        });
      }

      const brief = await generateAccountBrief(ctx.orgId, input.accountId, {
        forceRefresh: input.forceRefresh,
      });
      try {
        return createAccountBriefHandoff(brief, privateKeyPem);
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "BoundaryAttest signing failed. Check the configured Ed25519 private key.",
        });
      }
    }),

  accountSignals: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => gatherAccountSignals(ctx.orgId, input.accountId)),

  briefHistory: protectedProcedure
    .input(z.object({ accountId: z.number(), limit: z.number().min(1).max(50).optional() }))
    .query(async ({ input }) => getAccountBriefHistory(input.accountId, input.limit ?? 10)),

  /**
   * The Company Brain: verified portfolio snapshot + the lessons the model has accumulated
   * across learning cycles. Reads are instant (in-memory digest); a background learning
   * cycle is scheduled automatically when the underlying data has changed.
   */
  brain: protectedProcedure.query(async ({ ctx }) => getBrainDigest(ctx.orgId)),

  /** Force a learning cycle now (admin/debug — normally runs in the background). */
  brainLearn: protectedProcedure.mutation(async ({ ctx }) => learnCycle(ctx.orgId, true)),
});
