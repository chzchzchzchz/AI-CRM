import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { queryDust, generateAccountIntelligence, generateContactIntelligence, searchGongCalls } from "../dust";
import { getCachedDustResponse, cacheDustResponse } from "../db-dust";

export const dustRouter = router({
  /**
   * Get account intelligence from Dust (with caching)
   */
  getAccountIntelligence: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        accountName: z.string(),
        accountDetails: z.string().optional(),
        forceRefresh: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { accountId, accountName, accountDetails, forceRefresh } = input;

      // Check cache first
      if (!forceRefresh) {
        const cached = await getCachedDustResponse(
          `account-intelligence:${accountName}`,
          accountId
        );
        if (cached) {
          return { success: true, intelligence: cached, fromCache: true };
        }
      }

      try {
        const intelligence = await generateAccountIntelligence(
          accountName,
          accountDetails || ""
        );

        // Cache the result
        await cacheDustResponse(
          `account-intelligence:${accountName}`,
          intelligence,
          accountId,
          undefined,
          24 // 24 hour TTL
        );

        return { success: true, intelligence, fromCache: false };
      } catch (error) {
        if (error instanceof Error && error.message === "DUST_RATE_LIMIT") {
          return {
            success: false,
            error: "Rate limit exceeded. Please try again later.",
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * Get contact intelligence from Dust (with caching)
   */
  getContactIntelligence: protectedProcedure
    .input(
      z.object({
        contactId: z.number(),
        contactName: z.string(),
        contactEmail: z.string(),
        companyName: z.string(),
        forceRefresh: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const {
        contactId,
        contactName,
        contactEmail,
        companyName,
        forceRefresh,
      } = input;

      // Check cache first
      if (!forceRefresh) {
        const cached = await getCachedDustResponse(
          `contact-intelligence:${contactEmail}`,
          undefined,
          contactId
        );
        if (cached) {
          return { success: true, intelligence: cached, fromCache: true };
        }
      }

      try {
        const intelligence = await generateContactIntelligence(
          contactName,
          contactEmail,
          companyName
        );

        // Cache the result
        await cacheDustResponse(
          `contact-intelligence:${contactEmail}`,
          intelligence,
          undefined,
          contactId,
          24 // 24 hour TTL
        );

        return { success: true, intelligence, fromCache: false };
      } catch (error) {
        if (error instanceof Error && error.message === "DUST_RATE_LIMIT") {
          return {
            success: false,
            error: "Rate limit exceeded. Please try again later.",
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * Search Gong calls in Dust
   */
  searchGongCalls: protectedProcedure
    .input(
      z.object({
        accountName: z.string(),
        contactName: z.string().optional(),
        forceRefresh: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { accountName, contactName, forceRefresh } = input;

      const queryKey = `gong-calls:${accountName}:${contactName || "all"}`;

      // Check cache first
      if (!forceRefresh) {
        const cached = await getCachedDustResponse(queryKey);
        if (cached) {
          return { success: true, calls: cached, fromCache: true };
        }
      }

      try {
        const calls = await searchGongCalls(accountName, contactName);

        // Cache the result
        await cacheDustResponse(queryKey, calls, undefined, undefined, 48); // 48 hour TTL

        return { success: true, calls, fromCache: false };
      } catch (error) {
        if (error instanceof Error && error.message === "DUST_RATE_LIMIT") {
          return {
            success: false,
            error: "Rate limit exceeded. Please try again later.",
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * Custom Dust query
   */
  query: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        assistant: z
          .enum(["dust", "deep-dive", "gpt-5-nano", "gpt-5"])
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { query, assistant } = input;

      try {
        const result = await queryDust(query, { assistant });
        return { success: true, result };
      } catch (error) {
        if (error instanceof Error && error.message === "DUST_RATE_LIMIT") {
          return {
            success: false,
            error: "Rate limit exceeded. Please try again later.",
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
});
