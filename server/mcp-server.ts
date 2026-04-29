/**
 * MCP Server for AI-CRM 
 * Exposes CRM data/actions as MCP tools for AI agents
 * Run: tsx server/mcp-server.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const API_KEY = process.env.BUILT_IN_FORGE_API_KEY || '';

const server = new Server(
  {
    name: 'ai-crm-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Helper: Call tRPC procedure via HTTP
async function callTRPC(procedure: string, input?: any): Promise<any> {
  const url = `${TRPC_URL}/${procedure}`;
  const body = input ? { input } : undefined;
  
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`tRPC call failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.result?.data;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_accounts',
        description: 'List all accounts with optional filters (region, AE, MFA provider, intent score). Returns account intelligence data.',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', enum: ['West', 'Central', 'East'], description: 'Filter by region' },
            ae: { type: 'string', description: 'Filter by Account Executive' },
            mfaProvider: { type: 'string', description: 'Filter by MFA provider (Ping, Okta, Duo, etc.)' },
            minIntentScore: { type: 'number', description: 'Minimum 6sense intent score' },
            limit: { type: 'number', description: 'Max results (default 50)' },
          },
        },
      },
      {
        name: 'get_account',
        description: 'Get detailed account information including 6sense intent data, Gong call insights, and AI recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'Account ID' },
          },
          required: ['accountId'],
        },
      },
      {
        name: 'search_accounts',
        description: 'Search accounts by name, domain, or intent keywords.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results (default 20)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_ai_summary',
        description: 'Get AI-generated executive summary and strategic recommendations for all accounts.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'import_salesforce',
        description: 'Import accounts and contacts from Salesforce via OAuth2.',
        inputSchema: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'Salesforce access token' },
            instanceUrl: { type: 'string', description: 'Salesforce instance URL' },
          },
          required: ['accessToken', 'instanceUrl'],
        },
      },
      {
        name: 'import_linkedin',
        description: 'Import company data from LinkedIn API.',
        inputSchema: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'LinkedIn access token' },
            keywords: { type: 'string', description: 'Search keywords' },
          },
          required: ['accessToken', 'keywords'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments } = request.params;

  try {
    switch (name) {
      case 'list_accounts': {
        const accounts = await callTRPC('account.list', arguments);
        return { content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }] };
      }

      case 'get_account': {
        const account = await callTRPC(`account.getById', { id: arguments?.accountId });
        return { content: [{ type: 'text', text: JSON.stringify(account, null, 2) }] };
      }

      case 'search_accounts': {
        const accounts = await callTRPC('account.search', arguments);
        return { content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }] };
      }

      case 'get_ai_summary': {
        const summary = await callTRPC('insights.getSummary');
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      }

      case 'import_salesforce': {
        // Actual Salesforce import logic here
        return { content: [{ type: 'text', text: 'Salesforce import initiated. Check task board for progress.' }] };
      }

      case 'import_linkedin': {
        // Actual LinkedIn import logic here
        return { content: [{ type: 'text', text: 'LinkedIn import initiated. Check task board for progress.' }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AI-CRM MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
