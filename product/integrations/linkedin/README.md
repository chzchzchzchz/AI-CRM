# LinkedIn Integration Setup#

## Overview#
Import company data, employee counts, job postings, and news via LinkedIn API.

## Prerequisites#

1. **LinkedIn Developer Account**: https://www.linkedin.com/developers/
2. **App Creation**: Create app in LinkedIn Developer Portal
3. **Products to Add**:
   - **Marketing API** (company data, job postings)
   - **Advertising API** (optional, for ad data)
   - **Sign In with LinkedIn** (OAuth2)

---

## Step 1: Create LinkedIn App#

1. Go to https://www.linkedin.com/developers/apps/
2. Click **Create App**
3. Fill in:
   - **App Name**: `AI-CRM Integration`
   - **Company**: Your company (or personal)
   - **Privacy Policy URL**: `https://yourdomain.com/privacy`
   - **Business Email**: Your email
4. **Verify** your app (may take 24-48h for some products)
5. Note your **Client ID** and **Client Secret**

---

## Step 2: Set OAuth2 Scopes#

In your LinkedIn App → **Auth** tab, add redirect URL:
```
http://localhost:3000/api/callback/linkedin
https://yourdomain.com/api/callback/linkedin
```

**Required Scopes** (add in Auth tab):
- `r_liteprofile` - Read basic profile
- `r_emailaddress` - Read email (if Sign In)
- `rw_organization_admin` - Manage company pages (if you have a company page)
- `r_organization_social` - Read company posts/analytics

---

## Step 3: Environment Variables#

```bash
# LinkedIn OAuth2
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_CALLBACK_URL=http://localhost:3000/api/callback/linkedin

# For production:
# LINKEDIN_CALLBACK_URL=https://yourdomain.com/api/callback/linkedin
```

---

## Step 4: OAuth2 Flow#

### 4.1 Initiate Authorization#

```typescript
// product/integrations/linkedin/auth.ts
export function getLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_CALLBACK_URL!,
    scope: 'r_liteprofile r_emailaddress',
    state: state, // CSRF protection
  });
  
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}
```

### 4.2 Exchange Code for Tokens#

```typescript
export async function exchangeCodeForTokens(code: string) {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: process.env.LINKEDIN_CALLBACK_URL!,
    }),
  });
  
  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in, // Usually 60 days
    refresh_token: data.refresh_token, // If your app has refresh token enabled
  };
}
```

---

## Step 5: Import Company Data#

### 5.1 Search for Companies#

```typescript
// product/integrations/linkedin/import.ts
export async function searchCompanies(accessToken: string, keywords: string) {
  const response = await fetch(
    `https://api.linkedin.com/v2/organizations?q=vanityName&vanityName=${keywords}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  const data = await response.json();
  return data.elements; // Array of company objects
}
```

### 5.2 Get Company Details#

```typescript
export async function getCompanyDetails(accessToken: string, orgId: string) {
  const response = await fetch(
    `https://api.linkedin.com/v2/organizations/${orgId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  const company = await response.json();
  return {
    id: company.id,
    name: company.localizedName,
    description: company.localizedDescription,
    website: company.website,
    industry: company.industry,
    employeeCount: company.staffCount,
    followers: company.followerCount,
    founded: company.foundedOn,
    headquarters: company.headquarter,
  };
}
```

### 5.3 Get Employee Count (via Sales Navigator API - Enterprise)#

```typescript
// Requires Sales Navigator API access (separate product)
export async function getEmployeeCount(accessToken: string, companyName: string) {
  const response = await fetch(
    `https://api.linkedin.com/v2/sales/companies?q=name&name=${companyName}`,
    {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'X-RestLi-Protocol-Version': '2.0.0',
      },
    }
  );
  
  return await response.json();
}
```

### 5.4 Get Job Postings#

```typescript
export async function getJobPostings(accessToken: string, orgId: string) {
  const response = await fetch(
    `https://api.linkedin.com/v2/jobs?q=company&company=${orgId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  const data = await response.json();
  return data.elements?.map(job => ({
    id: job.id,
    title: job.title?.localized?.en_US,
    location: job.workplaceType?.localized?.en_US,
    postedAt: job.postedAt,
    description: job.description?.localized?.en_US,
  })) || [];
}
```

---

## Step 6: Map to AI-CRM Schema#

```typescript
// product/integrations/linkedin/mapping.ts
export function mapToAI_CRMCompany(linkedinCompany: any) {
  return {
    externalId: `linkedin:${linkedinCompany.id}`,
    name: linkedinCompany.name,
    domain: linkedinCompany.website ? new URL(linkedinCompany.website).hostname : null,
    industry: linkedinCompany.industry,
    employeeCount: linkedinCompany.employeeCount,
    location: linkedinCompany.headquarters,
    metadata: {
      source: 'linkedin',
      originalId: linkedinCompany.id,
      followers: linkedinCompany.followers,
      founded: linkedinCompany.founded,
      description: linkedinCompany.description,
    },
    lastSyncedAt: new Date(),
  };
}
```

---

## Step 7: tRPC Router#

```typescript
// server/routers/linkedin.ts
import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { getLinkedInAuthUrl } from '../../product/integrations/linkedin/auth';
import { exchangeCodeForTokens, searchCompanies, getCompanyDetails } from '../../product/integrations/linkedin/import';

export const linkedinRouter = router({
  // Get OAuth2 URL
  authUrl: protectedProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }) => getLinkedInAuthUrl(input.state)),
    
  // OAuth2 callback
  callback: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input }) => {
      const tokens = await exchangeCodeForTokens(input.code);
      // Store tokens in DB (user-specific)
      await storeUserLinkedInTokens({ 
        userId: ctx.user.id, 
        accessToken: tokens.access_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      });
      return { success: true };
    }),
    
  // Search companies
  search: protectedProcedure
    .input(z.object({ keywords: z.string() }))
    .query(async ({ input, ctx }) => {
      const tokens = await getUserLinkedInTokens(ctx.user.id);
      const companies = await searchCompanies(tokens.accessToken, input.keywords);
      return companies;
    }),
    
  // Import company details
  importCompany: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const tokens = await getUserLinkedInTokens(ctx.user.id);
      const company = await getCompanyDetails(tokens.accessToken, input.orgId);
      const mapped = mapToAI_CRMCompany(company);
      await upsertAccount(mapped);
      return { imported: true, company: mapped };
    }),
});
```

---

## Step 8: Test Integration#

1. **Start dev server**: `pnpm dev`
2. **Navigate to Settings → Integrations → LinkedIn**
3. **Click "Connect LinkedIn"** → OAuth2 popup
4. **Authorize** the app in LinkedIn
5. **Callback** → should redirect back
6. **Search for a company**: "OpenAI", "Salesforce", etc.
7. **Import** → should add to AI-CRM accounts

---

## API Endpoints Reference#

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/v2/authorization` | GET | Initiate OAuth2 |
| `/oauth/v2/accessToken` | POST | Exchange code for tokens |
| `/v2/organizations` | GET | Get company data |
| `/v2/jobs` | GET | Get job postings |
| `/v2/sales/companies` | GET | Sales Navigator company search |

---

## Troubleshooting#

### Error: `invalid_api_key`
- Check `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are correct
- Verify app is approved (some products need review)

### Error: `missing_scope`
- Ensure your app has the required products added (Marketing API, etc.)
- Check scopes in Auth tab match what you're requesting

### Error: `rate_limit_exceeded`
- LinkedIn API: 100 requests/day for basic apps
- Implement retry logic with exponential backoff
- Cache responses when possible

---

## Files to Create (Agent Task)#

- [ ] `product/integrations/linkedin/auth.ts` - OAuth2 flow
- [ ] `product/integrations/linkedin/import.ts` - Data import functions  
- [ ] `product/integrations/linkedin/mapping.ts` - Schema mapping
- [ ] `server/routers/linkedin.ts` - tRPC router
- [ ] `client/src/pages/Settings/Integrations/LinkedIn.tsx` - UI page
- [ ] `__tests__/product/integrations/linkedin.test.ts` - Unit tests

---

**Next Agent**: Pick up task R002 (LinkedIn API setup) from the Task Board.
