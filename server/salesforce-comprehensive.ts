/**
 * COMPREHENSIVE SALESFORCE INTEGRATION
 * 
 * Pulls ALL available fields for accounts and contacts
 * Supports incremental sync and daily auto-updates
 */

import { ENV } from './_core/env';
import { normalizeDomain } from './domain-utils';
import { getDb } from './db';
import { accounts, contacts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const SALESFORCE_CLIENT_ID = ENV.salesforceClientId;
const SALESFORCE_CLIENT_SECRET = ENV.salesforceClientSecret;
const SALESFORCE_INSTANCE_URL = ENV.salesforceInstanceUrl;

// Token cache
let cachedToken: { token: string; instanceUrl: string; expiresAt: number } | null = null;

/**
 * Get OAuth access token
 */
export async function getAccessToken(): Promise<{ token: string; instanceUrl: string }> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return { token: cachedToken.token, instanceUrl: cachedToken.instanceUrl };
  }

  if (!SALESFORCE_CLIENT_ID || !SALESFORCE_CLIENT_SECRET) {
    throw new Error('Salesforce credentials not configured');
  }

  const tokenUrl = `${SALESFORCE_INSTANCE_URL}/services/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SALESFORCE_CLIENT_ID,
    client_secret: SALESFORCE_CLIENT_SECRET,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Salesforce token: ${response.statusText}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    instanceUrl: data.instance_url,
    expiresAt: Date.now() + 3600000, // 1 hour
  };

  return { token: data.access_token, instanceUrl: data.instance_url };
}

/**
 * Execute SOQL query
 */
export async function query<T>(soql: string): Promise<T[]> {
  const { token, instanceUrl } = await getAccessToken();
  
  const url = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce query failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.records || [];
}

/**
 * Fetch ALL account fields from Salesforce
 */
export async function fetchAllAccountFields(): Promise<any[]> {
  // Get all field names from Account object
  const { token, instanceUrl } = await getAccessToken();
  
  const url = `${instanceUrl}/services/data/v59.0/sobjects/Account/describe`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to describe Account object: ${response.statusText}`);
  }

  const describe = await response.json();
  const fieldNames = describe.fields
    .filter((f: any) => f.updateable && !f.name.endsWith('__r')) // Exclude relationships
    .map((f: any) => f.name);

  // Build SELECT clause with all fields
  const selectClause = fieldNames.join(', ');
  
  const soql = `
    SELECT ${selectClause}
    FROM Account
    WHERE IsDeleted = false
    ORDER BY LastModifiedDate DESC
    LIMIT 2000
  `;

  return query(soql);
}

/**
 * Fetch ALL contact fields from Salesforce
 */
export async function fetchAllContactFields(): Promise<any[]> {
  // Get all field names from Contact object
  const { token, instanceUrl } = await getAccessToken();
  
  const url = `${instanceUrl}/services/data/v59.0/sobjects/Contact/describe`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to describe Contact object: ${response.statusText}`);
  }

  const describe = await response.json();
  const fieldNames = describe.fields
    .filter((f: any) => f.updateable && !f.name.endsWith('__r')) // Exclude relationships
    .map((f: any) => f.name);

  // Build SELECT clause with all fields
  const selectClause = fieldNames.join(', ');
  
  const soql = `
    SELECT ${selectClause}
    FROM Contact
    WHERE IsDeleted = false
    ORDER BY LastModifiedDate DESC
    LIMIT 10000
  `;

  return query(soql);
}

/**
 * Fetch accounts modified since a specific date (incremental sync)
 */
export async function fetchAccountsModifiedSince(sinceDate: Date): Promise<any[]> {
  const isoDate = sinceDate.toISOString().split('T')[0];
  
  const soql = `
    SELECT Id, Name, Website, Industry, NumberOfEmployees, 
           BillingCity, BillingState, BillingCountry, Description, Type, Phone, OwnerId,
           Sequence_Type__c, Campaign_Focus__c, Intent_Score__c, Buying_Stage__c,
           ARR__c, Account_Status__c, Revenue, Fax, BillingStreet, BillingPostalCode,
           ShippingCity, ShippingState, ShippingCountry, ShippingStreet, ShippingPostalCode,
           AccountNumber, SicCode, Ownership, TickerSymbol, AnnualRevenue,
           LastModifiedDate, CreatedDate, ParentId
    FROM Account
    WHERE IsDeleted = false AND LastModifiedDate >= ${isoDate}T00:00:00Z
    ORDER BY LastModifiedDate DESC
    LIMIT 2000
  `;

  return query(soql);
}

/**
 * Fetch contacts modified since a specific date (incremental sync)
 */
export async function fetchContactsModifiedSince(sinceDate: Date): Promise<any[]> {
  const isoDate = sinceDate.toISOString().split('T')[0];
  
  const soql = `
    SELECT Id, FirstName, LastName, Name, Email, Phone, Title, AccountId, 
           Account.Name, MailingCity, MailingState, MailingCountry, LinkedIn_URL__c,
           MobilePhone, Fax, Department, ReportsToId, MailingStreet, MailingPostalCode,
           OtherCity, OtherState, OtherCountry, OtherStreet, OtherPostalCode,
           HomePhone, OtherPhone, AssistantName, AssistantPhone, LeadSource,
           LastModifiedDate, CreatedDate, Birthdate, Description
    FROM Contact
    WHERE IsDeleted = false AND LastModifiedDate >= ${isoDate}T00:00:00Z
    ORDER BY LastModifiedDate DESC
    LIMIT 10000
  `;

  return query(soql);
}

/**
 * Transform Salesforce account to database format
 */
export function transformAccount(sfAccount: any): Partial<typeof accounts.$inferInsert> {
  return {
    sfdcAccountId: sfAccount.Id,
    name: sfAccount.Name,
    website: sfAccount.Website,
    domain: normalizeDomain(sfAccount.Website),
    industry: sfAccount.Industry,
    employeeCount: sfAccount.NumberOfEmployees,
    phone: sfAccount.Phone,
    type: sfAccount.Type,
    location: [sfAccount.BillingCity, sfAccount.BillingState, sfAccount.BillingCountry]
      .filter(Boolean)
      .join(', '),
    description: sfAccount.Description,
    // Sequence markers
    sequenceType: sfAccount.Sequence_Type__c,
    campaignFocus: sfAccount.Campaign_Focus__c,
    buyingStage: sfAccount.Buying_Stage__c,
    arr: sfAccount.ARR__c,
    accountStatus: sfAccount.Account_Status__c,
    // Additional fields
    revenue: sfAccount.Revenue || sfAccount.AnnualRevenue,
    // Store raw data for reference
    rawData: {
      sfdcData: sfAccount,
      syncedAt: new Date().toISOString(),
    },
  };
}

/**
 * Transform Salesforce contact to database format
 */
export function transformContact(sfContact: any): Partial<typeof contacts.$inferInsert> {
  const firstName = sfContact.FirstName || '';
  const lastName = sfContact.LastName || '';
  
  return {
    sfdcContactId: sfContact.Id,
    firstName: sfContact.FirstName,
    lastName: sfContact.LastName,
    name: sfContact.Name || `${firstName} ${lastName}`.trim(),
    email: sfContact.Email,
    phone: sfContact.Phone,
    mobilePhone: sfContact.MobilePhone,
    directPhone: sfContact.OtherPhone,
    title: sfContact.Title,
    department: sfContact.Department,
    location: [sfContact.MailingCity, sfContact.MailingState, sfContact.MailingCountry]
      .filter(Boolean)
      .join(', '),
    linkedinUrl: sfContact.LinkedIn_URL__c,
  };
}

/**
 * Sync all accounts from Salesforce
 */
export async function syncAllAccounts(): Promise<{ inserted: number; updated: number; errors: number }> {
  console.log('🔄 Syncing all accounts from Salesforce...');
  
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  try {
    const sfAccounts = await fetchAllAccountFields();
    console.log(`📊 Fetched ${sfAccounts.length} accounts from Salesforce`);

    for (const sfAccount of sfAccounts) {
      try {
        const transformed = transformAccount(sfAccount);

        // Check if exists
        const existing = await db
          .select()
          .from(accounts)
          .where(eq(accounts.sfdcAccountId, sfAccount.Id));

        if (existing.length > 0) {
          // Update
          await db
            .update(accounts)
            .set({ ...transformed, updatedAt: new Date() })
            .where(eq(accounts.sfdcAccountId, sfAccount.Id));
          updated++;
        } else {
          // Insert
          await db.insert(accounts).values(transformed as any);
          inserted++;
        }
      } catch (error) {
        console.error(`❌ Error syncing account ${sfAccount.Name}:`, error);
        errors++;
      }
    }

    console.log(`✅ Account sync complete: ${inserted} inserted, ${updated} updated, ${errors} errors`);
    return { inserted, updated, errors };
  } catch (error) {
    console.error('❌ Account sync failed:', error);
    throw error;
  }
}

/**
 * Sync all contacts from Salesforce
 */
export async function syncAllContacts(): Promise<{ inserted: number; updated: number; linked: number; errors: number }> {
  console.log('🔄 Syncing all contacts from Salesforce...');
  
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  let inserted = 0;
  let updated = 0;
  let linked = 0;
  let errors = 0;

  try {
    const sfContacts = await fetchAllContactFields();
    console.log(`📊 Fetched ${sfContacts.length} contacts from Salesforce`);

    // Build account lookup
    const allAccounts = await db.select().from(accounts);
    const accountsBySfdcId = new Map();
    for (const acc of allAccounts) {
      if (acc.sfdcAccountId) {
        accountsBySfdcId.set(acc.sfdcAccountId, acc.id);
      }
    }

    for (const sfContact of sfContacts) {
      try {
        const transformed = transformContact(sfContact);

        // Link to account if possible
        let accountId = null;
        if (sfContact.AccountId && accountsBySfdcId.has(sfContact.AccountId)) {
          accountId = accountsBySfdcId.get(sfContact.AccountId);
          linked++;
        }

        // Check if exists
        const existing = await db
          .select()
          .from(contacts)
          .where(eq(contacts.sfdcContactId, sfContact.Id));

        if (existing.length > 0) {
          // Update
          await db
            .update(contacts)
            .set({ ...transformed, accountId, updatedAt: new Date() })
            .where(eq(contacts.sfdcContactId, sfContact.Id));
          updated++;
        } else {
          // Insert
          await db.insert(contacts).values({ ...transformed, accountId } as any);
          inserted++;
        }
      } catch (error) {
        console.error(`❌ Error syncing contact ${sfContact.Name}:`, error);
        errors++;
      }
    }

    console.log(`✅ Contact sync complete: ${inserted} inserted, ${updated} updated, ${linked} linked, ${errors} errors`);
    return { inserted, updated, linked, errors };
  } catch (error) {
    console.error('❌ Contact sync failed:', error);
    throw error;
  }
}

/**
 * Incremental sync - only fetch modified records
 */
export async function incrementalSync(): Promise<{ accountsUpdated: number; contactsUpdated: number }> {
  console.log('🔄 Running incremental sync...');
  
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Sync accounts modified in last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const modifiedAccounts = await fetchAccountsModifiedSince(yesterday);
  
  let accountsUpdated = 0;
  for (const sfAccount of modifiedAccounts) {
    try {
      const transformed = transformAccount(sfAccount);
      const existing = await db
        .select()
        .from(accounts)
        .where(eq(accounts.sfdcAccountId, sfAccount.Id));

      if (existing.length > 0) {
        await db
          .update(accounts)
          .set({ ...transformed, updatedAt: new Date() })
          .where(eq(accounts.sfdcAccountId, sfAccount.Id));
        accountsUpdated++;
      }
    } catch (error) {
      console.error(`Error updating account ${sfAccount.Name}:`, error);
    }
  }

  // Sync contacts modified in last 24 hours
  const modifiedContacts = await fetchContactsModifiedSince(yesterday);
  
  let contactsUpdated = 0;
  const allAccounts = await db.select().from(accounts);
  const accountsBySfdcId = new Map();
  for (const acc of allAccounts) {
    if (acc.sfdcAccountId) {
      accountsBySfdcId.set(acc.sfdcAccountId, acc.id);
    }
  }

  for (const sfContact of modifiedContacts) {
    try {
      const transformed = transformContact(sfContact);
      let accountId = null;
      if (sfContact.AccountId && accountsBySfdcId.has(sfContact.AccountId)) {
        accountId = accountsBySfdcId.get(sfContact.AccountId);
      }

      const existing = await db
        .select()
        .from(contacts)
        .where(eq(contacts.sfdcContactId, sfContact.Id));

      if (existing.length > 0) {
        await db
          .update(contacts)
          .set({ ...transformed, accountId, updatedAt: new Date() })
          .where(eq(contacts.sfdcContactId, sfContact.Id));
        contactsUpdated++;
      }
    } catch (error) {
      console.error(`Error updating contact ${sfContact.Name}:`, error);
    }
  }

  console.log(`✅ Incremental sync complete: ${accountsUpdated} accounts, ${contactsUpdated} contacts updated`);
  return { accountsUpdated, contactsUpdated };
}
