import { z } from 'zod';
import fetch from 'node-fetch';

export const SalesforceAccountSchema = z.object({
  Id: z.string(),
  Name: z.string(),
  Industry: z.string().nullable(),
  AnnualRevenue: z.number().nullable(),
  NumberOfEmployees: z.number().nullable(),
  BillingCity: z.string().nullable(),
  BillingState: z.string().nullable(),
  BillingCountry: z.string().nullable(),
  Website: z.string().url().nullable(),
  Description: z.string().nullable(),
  LastModifiedDate: z.string(),
});

export const SalesforceContactSchema = z.object({
  Id: z.string(),
  FirstName: z.string().nullable(),
  LastName: z.string(),
  Email: z.string().email().nullable(),
  Phone: z.string().nullable(),
  Title: z.string().nullable(),
  AccountId: z.string().nullable(),
  Account: z.object({ Name: z.string() }).nullable(),
  Department: z.string().nullable(),
  LastModifiedDate: z.string(),
});

export async function querySalesforce(
  accessToken: string,
  instanceUrl: string,
  soqlQuery: string
): Promise<any[]> {
  const response = await fetch(
    `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soqlQuery)}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json() as any;
  if (data.errors) throw new Error(`Salesforce query error: ${JSON.stringify(data.errors)}`);
  if (!data.records) return [];
  
  // Handle paginated results
  let allRecords = data.records;
  let nextRecordsUrl = data.nextRecordsUrl;
  
  while (nextRecordsUrl) {
    const nextResponse = await fetch(`${instanceUrl}${nextRecordsUrl}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const nextData = await nextResponse.json() as any;
    allRecords = [...allRecords, ...nextData.records];
    nextRecordsUrl = nextData.nextRecordsUrl;
  }
  
  return allRecords;
}

export async function importAccounts(
  accessToken: string,
  instanceUrl: string
): Promise<any[]> {
  const query = `
    SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees,
           BillingCity, BillingState, BillingCountry, Website, Description,
           LastModifiedDate
    FROM Account
    WHERE LastModifiedDate >= LAST_N_DAYS:30
    ORDER BY LastModifiedDate DESC
    LIMIT 2000
  `;
  
  const accounts = await querySalesforce(accessToken, instanceUrl, query);
  return accounts.map(acc => SalesforceAccountSchema.parse(acc));
}

export async function importContacts(
  accessToken: string,
  instanceUrl: string
): Promise<any[]> {
  const query = `
    SELECT Id, FirstName, LastName, Email, Phone, Title,
           AccountId, Account.Name, Department, LastModifiedDate
    FROM Contact
    WHERE LastModifiedDate >= LAST_N_DAYS:30
    ORDER BY LastModifiedDate DESC
    LIMIT 2000
  `;
  
  const contacts = await querySalesforce(accessToken, instanceUrl, query);
  return contacts.map(contact => SalesforceContactSchema.parse(contact));
}

export function mapToAICRMAccount(sfAccount: any) {
  return {
    externalId: `salesforce:${sfAccount.Id}`,
    name: sfAccount.Name,
    industry: sfAccount.Industry,
    revenue: sfAccount.AnnualRevenue,
    employees: sfAccount.NumberOfEmployees,
    location: [sfAccount.BillingCity, sfAccount.BillingState, sfAccount.BillingCountry].filter(Boolean).join(', '),
    website: sfAccount.Website,
    description: sfAccount.Description,
    lastModified: sfAccount.LastModifiedDate,
    source: 'salesforce',
    rawData: sfAccount,
  };
}
