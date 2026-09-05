import { z } from "zod";
import { notifyOwner } from "./notification";
import { checkReadiness } from "./health";
import { probeStore } from "./shared-store";
import { getDb } from "../db";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./trpc";

export const systemRouter = router({
  /**
   * The uptime probe docs/CAPABILITIES.md promises.
   *
   * Its body was `() => ({ ok: true })` — a constant. Anyone monitoring with it, which
   * is exactly what it is documented for, got `ok: true` from an instance whose database
   * was unreachable, for the entire length of the outage.
   *
   * It now answers the same question `/api/ready` does, from the same code: the database
   * is queried and the auth-state store is probed. Public, so the payload stays thin by
   * construction — subsystem names and ok/down, never a connection string or a driver
   * error (asserted in health.test.ts).
   */
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(async () => {
      const report = await checkReadiness({ getDb, probeStore });
      return { ok: report.ready, checks: report.checks };
    }),

  notifyOwner: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
