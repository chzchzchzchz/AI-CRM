import { z } from 'zod';
import fetch from 'node-fetch';

const SALESFORCE_AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
const SALESFORCE_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';

export interface SalesforceTokens {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SALESFORCE_CLIENT_ID!,
    redirect_uri: process.env.SALESFORCE_CALLBACK_URL!,
    scope: 'api refresh_token offline_access id',
    state: state,
  });
  return `${SALESFORCE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<SalesforceTokens> {
  const response = await fetch(SALESFORCE_TOKEN_URL, {
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

  const data = await response.json() as any;
  if (data.error) throw new Error(`Salesforce OAuth error: ${data.error_description || data.error}`);
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    instance_url: data.instance_url,
    id: data.id,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<SalesforceTokens> {
  const response = await fetch(SALESFORCE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
    }),
  });

  const data = await response.json() as any;
  if (data.error) throw new Error(`Salesforce refresh error: ${data.error}`);
  
  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // Salesforce may not return new refresh token
    instance_url: data.instance_url,
    id: data.id,
  };
}
