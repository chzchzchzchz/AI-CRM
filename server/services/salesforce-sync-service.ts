/**
 * SALESFORCE SYNC SERVICE
 * 
 * Handles daily automatic syncing of Salesforce data
 * Runs incremental syncs to minimize API calls
 */

import { incrementalSync, syncAllAccounts, syncAllContacts } from '../salesforce-comprehensive';

interface SyncStatus {
  lastSync: Date | null;
  nextSync: Date | null;
  isRunning: boolean;
  lastError: string | null;
  syncCount: number;
  successCount: number;
  failureCount: number;
}

let syncStatus: SyncStatus = {
  lastSync: null,
  nextSync: null,
  isRunning: false,
  lastError: null,
  syncCount: 0,
  successCount: 0,
  failureCount: 0,
};

let syncInterval: NodeJS.Timeout | null = null;

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * Perform a single sync cycle
 */
export async function performSync(fullSync: boolean = false): Promise<void> {
  if (syncStatus.isRunning) {
    console.log('⏳ Sync already in progress, skipping...');
    return;
  }

  syncStatus.isRunning = true;
  syncStatus.syncCount++;

  try {
    console.log(`\n🔄 Starting Salesforce sync (${fullSync ? 'FULL' : 'INCREMENTAL'})...`);
    console.log(`   Sync #${syncStatus.syncCount} at ${new Date().toISOString()}`);

    if (fullSync) {
      // Full sync - fetch all data
      console.log('📥 Performing full sync...');
      const accountResult = await syncAllAccounts();
      const contactResult = await syncAllContacts();
      
      console.log(`✅ Full sync results:`);
      console.log(`   Accounts: ${accountResult.inserted} inserted, ${accountResult.updated} updated`);
      console.log(`   Contacts: ${contactResult.inserted} inserted, ${contactResult.updated} updated, ${contactResult.linked} linked`);
    } else {
      // Incremental sync - only fetch changed data
      console.log('📥 Performing incremental sync...');
      const result = await incrementalSync();
      
      console.log(`✅ Incremental sync results:`);
      console.log(`   Accounts: ${result.accountsUpdated} updated`);
      console.log(`   Contacts: ${result.contactsUpdated} updated`);
    }

    syncStatus.lastSync = new Date();
    syncStatus.lastError = null;
    syncStatus.successCount++;

    // Schedule next sync
    syncStatus.nextSync = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    console.log(`⏰ Next sync scheduled for ${syncStatus.nextSync.toISOString()}`);
  } catch (error) {
    syncStatus.failureCount++;
    syncStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Sync failed:', syncStatus.lastError);
  } finally {
    syncStatus.isRunning = false;
  }
}

/**
 * Start the daily sync scheduler
 */
export function startDailySync(): void {
  if (syncInterval) {
    console.log('⚠️  Daily sync already running');
    return;
  }

  console.log('🚀 Starting Salesforce daily sync scheduler...');

  // Perform initial sync immediately
  performSync(false).catch(console.error);

  // Schedule daily syncs (every 24 hours)
  syncInterval = setInterval(() => {
    performSync(false).catch(console.error);
  }, 24 * 60 * 60 * 1000);

  console.log('✅ Daily sync scheduler started');
}

/**
 * Stop the daily sync scheduler
 */
export function stopDailySync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏹️  Daily sync scheduler stopped');
  }
}

/**
 * Manually trigger a full sync
 */
export async function triggerFullSync(): Promise<void> {
  console.log('🔄 Manually triggering full Salesforce sync...');
  await performSync(true);
}

/**
 * Manually trigger an incremental sync
 */
export async function triggerIncrementalSync(): Promise<void> {
  console.log('🔄 Manually triggering incremental Salesforce sync...');
  await performSync(false);
}

/**
 * Initialize the sync service
 * Call this when the server starts
 */
export function initializeSyncService(): void {
  console.log('📋 Initializing Salesforce sync service...');
  
  // Start daily sync
  startDailySync();

  // Log status every hour
  setInterval(() => {
    const status = getSyncStatus();
    console.log(`\n📊 Sync Service Status:`);
    console.log(`   Last sync: ${status.lastSync ? status.lastSync.toISOString() : 'Never'}`);
    console.log(`   Next sync: ${status.nextSync ? status.nextSync.toISOString() : 'Not scheduled'}`);
    console.log(`   Running: ${status.isRunning ? 'Yes' : 'No'}`);
    console.log(`   Total syncs: ${status.syncCount}`);
    console.log(`   Successful: ${status.successCount}`);
    console.log(`   Failed: ${status.failureCount}`);
    if (status.lastError) {
      console.log(`   Last error: ${status.lastError}`);
    }
  }, 60 * 60 * 1000); // Every hour
}
