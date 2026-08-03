/**
 * Salesforce Integration Service
 * Handles OAuth authentication and data sync
 */

import { ENV } from './_core/env';

// Read from process.env at call time.
//
// These were module-level consts copied out of ENV, and ENV is itself built from
// process.env when it is first imported — so the value depended on import order
// twice over. Anything that loaded this before dotenv ran held "" for the life of
// the process, and every Salesforce call then failed with "not configured" against
// an .env file that plainly had the key in it.
const SALESFORCE_CLIENT_ID = () => process.env.SALESFORCE_CLIENT_ID || ENV.salesforceClientId;
const SALESFORCE_CLIENT_SECRET = () => process.env.SALESFORCE_CLIENT_SECRET || ENV.salesforceClientSecret;
const SALESFORCE_INSTANCE_URL = () =>
  process.env.SALESFORCE_INSTANCE_URL || ENV.salesforceInstanceUrl || "https://login.salesforce.com";

interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

interface SalesforceAccount {
  Id: string;
  Name: string;
  Website?: string;
  Industry?: string;
  NumberOfEmployees?: number;
  BillingCity?: string;
  BillingState?: string;
  BillingCountry?: string;
  Description?: string;
  Type?: string;
  Phone?: string;
  OwnerId?: string;
}

interface SalesforceContact {
  Id: string;
  FirstName?: string;
  LastName?: string;
  Name: string;
  Email?: string;
  Phone?: string;
  Title?: string;
  AccountId?: string;
  Account?: { Name: string };
  MailingCity?: string;
  MailingState?: string;
  MailingCountry?: string;
  LinkedIn_URL__c?: string;
}

interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

// Token cache
let cachedToken: { token: string; instanceUrl: string; expiresAt: number } | null = null;

/**
 * Get OAuth access token using client credentials flow
 */
export async function getAccessToken(): Promise<{ token: string; instanceUrl: string }> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return { token: cachedToken.token, instanceUrl: cachedToken.instanceUrl };
  }

  if (!SALESFORCE_CLIENT_ID() || !SALESFORCE_CLIENT_SECRET()) {
    throw new Error('Salesforce credentials not configured. Add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET to secrets.');
  }

  const tokenUrl = `${SALESFORCE_INSTANCE_URL()}/services/oauth2/token`;
  
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SALESFORCE_CLIENT_ID(),
    client_secret: SALESFORCE_CLIENT_SECRET(),
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce OAuth failed: ${response.status} - ${errorText}`);
  }

  const data: SalesforceTokenResponse = await response.json() as any;
  
  // Cache token for 1 hour (Salesforce tokens typically last 2 hours)
  cachedToken = {
    token: data.access_token,
    instanceUrl: data.instance_url,
    expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
  };

  return { token: data.access_token, instanceUrl: data.instance_url };
}

/** Drop the cached token — exposed for the 401 retry and for tests. */
export function resetSalesforceToken() {
  cachedToken = null;
}

/** One authenticated GET, retrying once on 401 with a fresh token. */
async function authedGet(path: string): Promise<Response> {
  const send = async () => {
    const { token, instanceUrl } = await getAccessToken();
    const url = path.startsWith('http') ? path : `${instanceUrl}${path}`;
    return fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  };

  let response = await send();
  // The cache holds a token for an hour. Salesforce can invalidate one sooner — a
  // session settings change, an admin revoke — and without this every query failed
  // for the rest of that hour with no attempt to re-authenticate.
  if (response.status === 401) {
    resetSalesforceToken();
    response = await send();
  }
  return response;
}

/**
 * Execute a SOQL query against Salesforce.
 *
 * Returns the first batch only. Use queryAll for anything that can exceed one batch;
 * Salesforce caps a query response at 2,000 records regardless of the LIMIT in the
 * SOQL, and hands back nextRecordsUrl for the remainder.
 */
export async function query<T>(soql: string): Promise<SalesforceQueryResponse<T>> {
  const response = await authedGet(`/services/data/v59.0/query?q=${encodeURIComponent(soql)}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce query failed: ${response.status} - ${errorText}`);
  }

  return response.json() as any;
}

/**
 * Execute a SOQL query and follow nextRecordsUrl to the end.
 *
 * The interface has declared `nextRecordsUrl` and `done` since this file was written
 * and nothing read either of them. Salesforce returns at most 2,000 records per
 * batch, so `LIMIT 5000` on contacts returned 2,000 and stopped — ordered by Name,
 * which means an org of 5,000 contacts synced A through roughly J and reported
 * success. A truncation that is sorted looks exactly like a smaller org.
 */
export async function queryAll<T>(soql: string, maxBatches = 25): Promise<T[]> {
  let batch = await query<T>(soql);
  const records: T[] = [...batch.records];
  let batches = 1;

  while (!batch.done && batch.nextRecordsUrl && batches < maxBatches) {
    const response = await authedGet(batch.nextRecordsUrl);
    if (!response.ok) {
      const errorText = await response.text();
      // Partial results reported as complete is the failure this function exists to
      // prevent, so a failed continuation throws rather than returning what it has.
      throw new Error(`Salesforce paging failed after ${records.length} records: ${response.status} - ${errorText}`);
    }
    batch = (await response.json()) as SalesforceQueryResponse<T>;
    records.push(...batch.records);
    batches += 1;
  }

  if (!batch.done && batch.nextRecordsUrl) {
    throw new Error(
      `Salesforce returned more than ${maxBatches} batches (${records.length} records so far). ` +
        `Raise maxBatches or narrow the query — silently keeping the first ${records.length} would misreport the org's size.`
    );
  }

  return records;
}

/**
 * Fetch all accounts from Salesforce
 */
export async function fetchAccounts(): Promise<SalesforceAccount[]> {
  const soql = `
    SELECT Id, Name, Website, Industry, NumberOfEmployees, 
           BillingCity, BillingState, BillingCountry, Description, Type, Phone, OwnerId
    FROM Account
    WHERE IsDeleted = false
    ORDER BY Name
  `;

  // No LIMIT: it did nothing except make the truncation look deliberate.
  return queryAll<SalesforceAccount>(soql);
}

/**
 * Fetch all contacts from Salesforce
 */
export async function fetchContacts(): Promise<SalesforceContact[]> {
  const soql = `
    SELECT Id, FirstName, LastName, Name, Email, Phone, Title, AccountId, 
           Account.Name, MailingCity, MailingState, MailingCountry
    FROM Contact
    WHERE IsDeleted = false
    ORDER BY Name
  `;

  return queryAll<SalesforceContact>(soql);
}

/**
 * Test the Salesforce connection
 */
export async function testConnection(): Promise<{ success: boolean; connected: boolean; message: string; accountCount?: number; contactCount?: number; error?: string }> {
  try {
    const { token, instanceUrl } = await getAccessToken();
    
    // Test with a simple query
    const accountResult = await query<{ expr0: number }>('SELECT COUNT() FROM Account');
    const contactResult = await query<{ expr0: number }>('SELECT COUNT() FROM Contact');
    
    return {
      success: true,
      connected: true,
      message: `Connected to Salesforce at ${instanceUrl}`,
      accountCount: accountResult.totalSize,
      contactCount: contactResult.totalSize,
    };
  } catch (error) {
    return {
      success: false,
      connected: false,
      message: error instanceof Error ? error.message : 'Unknown error connecting to Salesforce',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract domain from website URL
 */
function extractDomain(website: string | undefined): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return website.replace('www.', '').split('/')[0];
  }
}

/**
 * Map Salesforce region from billing address
 */
function mapRegion(state: string | undefined, country: string | undefined): string {
  if (!country || country.toLowerCase() === 'united states' || country.toLowerCase() === 'usa' || country.toLowerCase() === 'us') {
    // US regions
    const westStates = ['CA', 'WA', 'OR', 'NV', 'AZ', 'UT', 'CO', 'NM', 'HI', 'AK', 'ID', 'MT', 'WY'];
    const centralStates = ['TX', 'IL', 'OH', 'MI', 'IN', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'SD', 'ND', 'OK', 'AR', 'LA'];
    const eastStates = ['NY', 'FL', 'PA', 'NJ', 'MA', 'VA', 'NC', 'GA', 'MD', 'CT', 'SC', 'DC', 'NH', 'ME', 'VT', 'RI', 'DE', 'WV', 'KY', 'TN', 'AL', 'MS'];
    
    const stateUpper = (state || '').toUpperCase();
    if (westStates.includes(stateUpper)) return 'West';
    if (centralStates.includes(stateUpper)) return 'Central';
    if (eastStates.includes(stateUpper)) return 'East';
    return 'United States';
  }
  return 'International';
}

/**
 * Transform Salesforce account to dashboard format
 */
export function transformAccount(sfAccount: SalesforceAccount): {
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  region: string;
  website: string | null;
  sfdcAccountId: string;
  description: string | null;
  phone: string | null;
  type: string | null;
} {
  return {
    name: sfAccount.Name,
    domain: extractDomain(sfAccount.Website),
    industry: sfAccount.Industry || null,
    employeeCount: sfAccount.NumberOfEmployees || null,
    region: mapRegion(sfAccount.BillingState, sfAccount.BillingCountry),
    website: sfAccount.Website || null,
    sfdcAccountId: sfAccount.Id,
    description: sfAccount.Description || null,
    phone: sfAccount.Phone || null,
    type: sfAccount.Type || null,
  };
}

/**
 * Transform Salesforce contact to dashboard format
 */
export function transformContact(sfContact: SalesforceContact): {
  name: string;
  email: string | null;
  title: string | null;
  phone: string | null;
  sfdcContactId: string;
  sfdcAccountId: string | null;
  linkedinUrl: string | null;
  location: string | null;
} {
  const location = [sfContact.MailingCity, sfContact.MailingState, sfContact.MailingCountry]
    .filter(Boolean)
    .join(', ') || null;
    
  return {
    name: sfContact.Name || `${sfContact.FirstName || ''} ${sfContact.LastName || ''}`.trim(),
    email: sfContact.Email || null,
    title: sfContact.Title || null,
    phone: sfContact.Phone || null,
    sfdcContactId: sfContact.Id,
    sfdcAccountId: sfContact.AccountId || null,
    linkedinUrl: sfContact.LinkedIn_URL__c || null,
    location,
  };
}
