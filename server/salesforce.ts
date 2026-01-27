/**
 * Salesforce Integration Service
 * Handles OAuth authentication and data sync
 */

import { ENV } from './_core/env';

// Salesforce OAuth configuration
const SALESFORCE_CLIENT_ID = ENV.salesforceClientId;
const SALESFORCE_CLIENT_SECRET = ENV.salesforceClientSecret;
const SALESFORCE_INSTANCE_URL = ENV.salesforceInstanceUrl;

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

  if (!SALESFORCE_CLIENT_ID || !SALESFORCE_CLIENT_SECRET) {
    throw new Error('Salesforce credentials not configured. Add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET to secrets.');
  }

  const tokenUrl = `${SALESFORCE_INSTANCE_URL}/services/oauth2/token`;
  
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SALESFORCE_CLIENT_ID,
    client_secret: SALESFORCE_CLIENT_SECRET,
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

  const data: SalesforceTokenResponse = await response.json();
  
  // Cache token for 1 hour (Salesforce tokens typically last 2 hours)
  cachedToken = {
    token: data.access_token,
    instanceUrl: data.instance_url,
    expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
  };

  return { token: data.access_token, instanceUrl: data.instance_url };
}

/**
 * Execute a SOQL query against Salesforce
 */
export async function query<T>(soql: string): Promise<SalesforceQueryResponse<T>> {
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

  return response.json();
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
    LIMIT 2000
  `;
  
  const result = await query<SalesforceAccount>(soql);
  return result.records;
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
    LIMIT 5000
  `;
  
  const result = await query<SalesforceContact>(soql);
  return result.records;
}

/**
 * Test the Salesforce connection
 */
export async function testConnection(): Promise<{ success: boolean; message: string; accountCount?: number; contactCount?: number }> {
  try {
    const { token, instanceUrl } = await getAccessToken();
    
    // Test with a simple query
    const accountResult = await query<{ expr0: number }>('SELECT COUNT() FROM Account');
    const contactResult = await query<{ expr0: number }>('SELECT COUNT() FROM Contact');
    
    return {
      success: true,
      message: `Connected to Salesforce at ${instanceUrl}`,
      accountCount: accountResult.totalSize,
      contactCount: contactResult.totalSize,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error connecting to Salesforce',
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
