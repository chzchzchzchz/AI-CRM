/**
 * UNIFIED ENRICHMENT ROUTER
 * 
 * tRPC endpoints for unified data enrichment
 */

import { protectedProcedure, router } from '../_core/trpc';
import { enrichContact, UnifiedEnrichmentInput } from '../services/unified-enrichment-service';
import { z } from 'zod';

const enrichmentInputSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  domain: z.string().optional(),
  linkedinUrl: z.string().optional(),
  sfdcContactId: z.string().optional(),
  sfdcAccountId: z.string().optional(),
});

export const unifiedEnrichmentRouter = router({
  /**
   * Enrich a contact or account from all available sources
   */
  enrich: protectedProcedure
    .input(enrichmentInputSchema)
    .mutation(async ({ input }): Promise<{
      success: boolean;
      insights?: string;
      collatedData?: Record<string, any>;
      error?: string;
    }> => {
      try {
        const result = await enrichContact(input as UnifiedEnrichmentInput);
        
        if (result.success) {
          return {
            success: true,
            insights: result.insights,
            collatedData: result.collatedData as Record<string, any>,
          };
        } else {
          return {
            success: false,
            error: result.error,
          };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),
});
