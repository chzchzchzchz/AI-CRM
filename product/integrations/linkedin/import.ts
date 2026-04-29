import { z } from 'zod';
import fetch from 'node-fetch';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

export interface LinkedInCompany {
  id: string;
  name: string;
  description: string;
  websiteUrl: string | null;
  staffCount: number | null;
  industry: string | null;
  founded: string | null;
  headquarters: string | null;
}

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  industry: string | null;
  publicProfileUrl: string;
}

export function getLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_CALLBACK_URL!,
    scope: 'r_liteprofile r_emailaddress w_organization_social',
    state: state,
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const response = await fetch(LINKEDIN_TOKEN_URL, {
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

  const data = await response.json() as any;
  if (data.error) throw new Error(`LinkedIn OAuth error: ${data.error_description || data.error}`);
  
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
  };
}

export async function searchCompanies(
  accessToken: string,
  keywords: string
): Promise<LinkedInCompany[]> {
  const url = new URL('https://api.linkedin.com/v2/organizations');
  url.searchParams.set('q', keywords);
  url.searchParams.set('count', '50');
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  const data = await response.json() as any;
  if (data.error) throw new Error(`LinkedIn API error: ${data.message}`);
  return data.elements || [];
}

export function mapToAICRMLinkedIn(company: LinkedInCompany) {
  return {
    externalId: `linkedin:${company.id}`,
    name: company.name,
    description: company.description,
    website: company.websiteUrl,
    industry: company.industry,
    employees: company.staffCount,
    founded: company.founded,
    headquarters: company.headquarters,
    source: 'linkedin',
    rawData: company,
  };
}
