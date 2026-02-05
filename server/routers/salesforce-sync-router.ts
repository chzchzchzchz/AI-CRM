/**
 * SALESFORCE SYNC ROUTER
 * 
 * tRPC endpoints for managing Salesforce syncs
 */

import { protectedProcedure, router } from '../_core/trpc';
import { 
  getSyncStatus, 
  triggerFullSync, 
  triggerIncrementalSync 
} from '../services/salesforce-sync-service';

export const salesforceSyncRouter = router({
  /**
   * Get current sync status
   */
  getStatus: protectedProcedure.query(async () => {
    const status = getSyncStatus();
    return {
      success: true,
      status: {
        lastSync: status.lastSync?.toISOString() || null,
        nextSync: status.nextSync?.toISOString() || null,
        isRunning: status.isRunning,
        lastError: status.lastError,
        syncCount: status.syncCount,
        successCount: status.successCount,
        failureCount: status.failureCount,
      },
    };
  }),

  /**
   * Trigger a full sync (fetch all data)
   */
  triggerFullSync: protectedProcedure.mutation(async () => {
    try {
      await triggerFullSync();
      return {
        success: true,
        message: 'Full sync triggered successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }),

  /**
   * Trigger an incremental sync (only changed data)
   */
  triggerIncrementalSync: protectedProcedure.mutation(async () => {
    try {
      await triggerIncrementalSync();
      return {
        success: true,
        message: 'Incremental sync triggered successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }),

  /**
   * Get sync statistics
   */
  getStatistics: protectedProcedure.query(async () => {
    try {
      const status = getSyncStatus();
      
      return {
        success: true,
        statistics: {
          lastSyncTime: status.lastSync?.toISOString() || null,
          nextSyncTime: status.nextSync?.toISOString() || null,
          totalSyncs: status.syncCount,
          successfulSyncs: status.successCount,
          failedSyncs: status.failureCount,
          isRunning: status.isRunning,
          lastError: status.lastError,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }),
});
