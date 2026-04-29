# Salesforce Integration Setup#

## Overview#
Connect your Salesforce org to AI-CRM. Import accounts, contacts, opportunities, and leads automatically.

## Prerequisites#

1. **Salesforce Org** (Production or Sandbox)
2. **Connected App** with OAuth2 (steps below)
3. **API Access** (Enterprise, Unlimited, or Developer Edition)

---

## Step 1: Create Connected App in Salesforce#

1. Log in to Salesforce → **Setup** (gear icon top-right)
2. Search for **"App Manager"** in Quick Find
3. Click **"New Connected App"**
4. Fill in:
   - **Connected App Name**: `AI-CRM Integration`
   - **API Name**: `AI_CRM_Integration`
   - **Contact Email**: your email
   - ✅ Check **"Enable OAuth Settings"**
   
5. **Callback URL** (update after getting ngrok/tunnel):
   ```
   http://localhost:3000/api/callback/salesforce
   https://[your-tunnel-url]/api/callback/salesforce
   ```

6. **Selected OAuth Scopes** (add these):
   - ✅ Access and manage your data (api)
   - ✅ Perform requests on your behalf at any time (refresh_token, offline_access)
   - ✅ Access your basic information (id, profile, email, address, phone)
   
7. **Save** → Note the **Consumer Key** (Client ID) and **Consumer Secret** (click "Click to reveal")

---

## Step 2: Set Environment Variables#

Create `.env.local` or add to `.env`:

```bash
# Salesforce OAuth2
SALESFORCE_CLIENT_ID=your_consumer_key_here
SALESFORCE_CLIENT_SECRET=your_consumer_secret_here
SALESFORCE_CALLBACK_URL=http://localhost:3000/api/callback/salesforce
# OR for production:
# SALESFORCE_CALLBACK_URL=https://yourdomain.com/api/callback/salesforce

# Your Salesforce instance URL (e.g., https://yourcompany.salesforce.com)
SALESFORCE_INSTANCE_URL=https://yourcompany.salesforce.com
```

---

## Step 3: OAuth2 Flow#

### 3.1 Initiate Authorization#

```typescript
// server/integrations/salesforce/auth.ts
import { z } from 'zod';
import express from 'express';

const SALESFORCE_AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
// For sandbox: 'https://test.salesforce.com/services/oauth2/authorize'

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SALESFORCE_CLIENT_ID!,
    redirect_uri: process.env.SALESFORCE_CALLBACK_URL!,
    scope: 'api refresh_token offline_access id',
    state: state, // CSRF protection
  });
  
  return `${SALESFORCE_AUTH_URL}?${params.toString()}`;
}
```

### 3.2 Exchange Code for Tokens#

```typescript
// server/integrations/salesforce/auth.ts
export async function exchangeCodeForTokens(code: string) {
  const tokenUrl = 'https://login.salesforce.com/services/oauth2/token';
  // For sandbox: 'https://test.salesforce.com/services/oauth2/token'
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      redirect_uri: process.env.SALESFORCE_CALLBACK_URL!,
    }),
  });
  
  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    instance_url: data.instance_url, // e.g., https://yourcompany.salesforce.com
    id: data.id, // User info URL
  };
}
```

### 3.3 Refresh Token (When Access Token Expires)#

```typescript
export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
    }),
  });
  
  return await response.json();
}
```

---

## Step 4: Import Data (Accounts, Contacts, Leads)#

### 4.1 Query Salesforce REST API#

```typescript
// server/integrations/salesforce/import.ts
import { z } from 'zod';

export async function importAccounts(accessToken: string, instanceUrl: string) {
  const query = `
    SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, 
           BillingCity, BillingState, BillingCountry, Website, Description
    FROM Account 
    WHERE LastModifiedDate = LAST_N_DAYS:30
    ORDER BY LastModifiedDate DESC
    LIMIT 2000
  `;
  
  const response = await fetch(
    `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const data = await response.json();
  if (data.errors) throw new Error(`Salesforce query error: ${JSON.stringify(data.errors)}`);
  
  return data.records; // Array of Account objects
}
```

### 4.2 Map Salesforce → AI-CRM Schema#

```typescript
// server/integrations/salesforce/mapping.ts
import { z } from 'zod';

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
});

export function mapToAI_CRMAccount(sfAccount: z.infer<typeof SalesforceAccountSchema>) {
  return {
    // AI-CRM canonical fields
    externalId: `salesforce:${sfAccount.Id}`,
    name: sfAccount.Name,
    domain: sfAccount.Website ? new URL(sfAccount.Website).hostname : null,
    industry: sfAccount.Industry,
    revenue: sfAccount.AnnualRevenue,
    employeeCount: sfAccount.NumberOfEmployees,
    location: [sfAccount.BillingCity, sfAccount.BillingState, sfAccount.BillingCountry]
      .filter(Boolean)
      .join(', '),
    metadata: {
      source: 'salesforce',
      originalId: sfAccount.Id,
      description: sfAccount.Description,
    },
    lastSyncedAt: new Date(),
  };
}
```

### 4.3 Import Contacts#

```typescript
export async function importContacts(accessToken: string, instanceUrl: string) {
  const query = `
    SELECT Id, FirstName, LastName, Email, Phone, Title, 
           AccountId, Account.Name, Department, 
           LastModifiedDate
    FROM Contact 
    WHERE LastModifiedDate = LAST_N_DAYS:30
    ORDER BY LastModifiedDate DESC
    LIMIT 5000
  `;
  
  const response = await fetch(
    `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(query)}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  return (await response.json()).records;
}
```

---

## Step 5: Set Up Continuous Sync#

### 5.1 Create Sync Router (tRPC)#

```typescript
// server/routers/salesforce.ts
import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { importAccounts, importContacts } from '../integrations/salesforce/import';

export const salesforceRouter = router({
  // Initiate OAuth2
  authUrl: protectedProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }) => getAuthUrl(input.state)),
    
  // OAuth2 callback
  callback: protectedProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ input }) => {
      const tokens = await exchangeCodeForTokens(input.code);
      // Store tokens in DB (user-specific)
      await storeUserSalesforceTokens({ 
        userId: ctx.user.id, 
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        instanceUrl: tokens.instance_url,
      });
      return { success: true, instanceUrl: tokens.instance_url };
    }),
    
  // Import accounts
  importAccounts: protectedProcedure
    .mutation(async ({ ctx }) => {
      const tokens = await getUserSalesforceTokens(ctx.user.id);
      const accounts = await importAccounts(tokens.accessToken, tokens.instanceUrl);
      // Map + upsert to AI-CRM DB
      const mapped = accounts.map(mapToAI_CRMAccount);
      await upsertAccounts(mapped);
      return { imported: mapped.length };
    }),
    
  // Import contacts
  importContacts: protectedProcedure
    .mutation(async ({ ctx }) => {
      const tokens = await getUserSalesforceTokens(ctx.user.id);
      const contacts = await importContacts(tokens.accessToken, tokens.instanceUrl);
      // Map + upsert
      return { imported: contacts.length };
    }),
    
  // Get sync status
  syncStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return await getSyncStatus(ctx.user.id);
    }),
});
```

### 5.2 Set Up Cron Job (Every 6 Hours)#

```typescript
// server/integrations/salesforce/sync.ts
import { cron } from 'node-cron';

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[Salesforce Sync] Starting...');
  const users = await getUsersWithSalesforceTokens();
    
  for (const user of users) {
    try {
      // Refresh token if needed
      const tokens = await ensureValidToken(user.salesforceTokens);
      // Import latest data
      await importAccounts(tokens.accessToken, tokens.instanceUrl);
      await importContacts(tokens.accessToken, tokens.instanceUrl);
      // Update last sync time
      await updateSyncStatus(user.id, { lastSync: new Date(), status: 'success' });
    } catch (error) {
      await updateSyncStatus(user.id, { lastSync: new Date(), status: 'error', error: error.message });
    }
  }
  
  console.log('[Salesforce Sync] Complete.');
});
```

---

## Step 6: Test the Integration#

1. **Start the dev server**: `pnpm dev`
2. **Navigate to Settings → Integrations → Salesforce**
3. **Click "Connect Salesforce"** → OAuth2 popup
4. **Authorize** the app in Salesforce
5. **Callback** → should redirect back to `/settings/integrations`
6. **Click "Import Now"** → should import accounts + contacts
7. **Check the DB**: `pnpm db:studio` → verify data imported

---

## API Endpoints Reference#

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/services/data/v59.0/query` | GET | SOQL query |
| `/services/data/v59.0/sobjects/Account` | POST | Create account |
| `/services/data/v59.0/sobjects/Account/{Id}` | PATCH | Update account |
| `/services/data/v59.0/sobjects/Contact` | POST | Create contact |
| `/services/data/v59.0/sobjects/Contact/{Id}` | PATCH | Update contact |

---

## Troubleshooting#

### Error: `invalid_client`
- Check `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET` are correct
- Verify Connected App is not deleted/expired

### Error: `redirect_uri_mismatch`
- Ensure callback URL in Connected App EXACTLY matches `SALESFORCE_CALLBACK_URL`
- No trailing slashes, no extra spaces

### Error: `rate_limit_exceeded`
- Salesforce API has limits (e.g., 15000 requests/24h for Enterprise)
- Implement exponential backoff + retry logic
- Use composite API for batch operations

---

## Files to Create (Agent Task)#

- [ ] `server/integrations/salesforce/auth.ts` - OAuth2 flow
- [ ] `server/integrations/salesforce/import.ts` - Data import functions
- [ ] `server/integrations/salesforce/mapping.ts` - Schema mapping
- [ ] `server/integrations/salesforce/sync.ts` - Continuous sync cron
- [ ] `server/routers/salesforce.ts` - tRPC router
- [ ] `client/src/pages/Settings/Integrations/Salesforce.tsx` - UI page
- [ ] `__tests__/server/integrations/salesforce.test.ts` - Unit tests

---

**Next Agent**: Pick up task R001 (Salesforce OAuth2 setup) from the Task Board.
