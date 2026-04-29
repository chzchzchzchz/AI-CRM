/**
 * MCP Server for AI-CRM 
 * Exposes CRM data/actions as MCP tools for AI agents
 * Run: node server/mcp-server.cjs
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fetch = require('node-fetch');

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
    },
  }
);

// Helper: Call tRPC procedure via HTTP
async function callTRPC(procedure, input) {
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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments;

  try {
    switch (name) {
      case 'list_accounts': {
        const accounts = await callTRPC('account.list', args);
        return { content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }] };
      }

      case 'get_account': {
        const account = await callTRPC('account.getById', { id: args?.accountId });
        return { content: [{ type: 'text', text: JSON.stringify(account, null, 2) }] };
      }

      case 'search_accounts': {
        const accounts = await callTRPC('account.search', args);
        return { content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }] };
      }

      case 'get_ai_summary': {
        const summary = await callTRPC('insights.getSummary');
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
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
