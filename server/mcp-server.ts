/**
 * MCP server for AI-CRM — exposes CRM data to any MCP-speaking agent over stdio.
 *
 * Run: pnpm mcp
 *
 * Every tool in this file was broken. The README carried a ✅ for the MCP server in
 * its feature table, gave it a section of its own, and marked "Phase 3: MCP server"
 * complete on the roadmap. What it actually did:
 *
 *   list_accounts     called account.list        — no such namespace (it is accounts)
 *   get_account       called account.getById     — same
 *   search_accounts   called account.search      — never existed at all
 *   get_ai_summary    called insights.getSummary — no insights namespace
 *   import_salesforce returned "Salesforce import initiated. Check task board for
 *                     progress." above a comment reading "Actual Salesforce import
 *                     logic here". Nothing was initiated. There is no task board.
 *   import_linkedin   the same lie, for an integration that exists nowhere in the repo
 *
 * Two further layers were wrong underneath the names. tRPC is configured with the
 * superjson transformer, so a query's input goes on the URL as {"json":…} and the
 * result comes back as {"result":{"data":{"json":…}}} — the old client sent a bare
 * object and read result.data, which is the superjson envelope rather than the value.
 * And it chose GET or POST by whether an input existed, so any query taking arguments
 * was sent as a POST and rejected.
 *
 * An earlier pass fixed the base URL and left a comment saying so. It never checked
 * whether the procedure names on the end of that URL existed. Fixing one layer and
 * assuming the next is the mistake this file is a monument to; server/mcp.test.ts now
 * asserts every procedure named below is actually in appRouter.
 *
 * Auth: procedures here are protected. With DEMO_MODE=true the server resolves a demo
 * user and no credential is needed. Against a real deployment, set MCP_SESSION_COOKIE
 * to a valid session cookie value.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { COOKIE_NAME } from '../shared/const';

// Must match where the app actually serves tRPC. This defaulted to
// http://localhost:3000/trpc — wrong port and wrong path — so the MCP server failed
// against a default install while the README advertised it with a tick.
const TRPC_URL =
  process.env.TRPC_URL || `http://localhost:${process.env.PORT || 3333}/api/trpc`;

/** A real session cookie. Not needed under DEMO_MODE, required otherwise. */
const SESSION = process.env.MCP_SESSION_COOKIE || '';

/**
 * Every procedure this server calls, and how it must be called.
 *
 * Exported so a test can assert each one exists in appRouter. A tool that names a
 * procedure nobody ever calls from the app is exactly how all six of these came to be
 * wrong without anything failing.
 */
export const PROCEDURES = {
  listAccounts: { path: 'accounts.list', kind: 'query' },
  getAccount: { path: 'accounts.getById', kind: 'query' },
  searchAccounts: { path: 'ai.search', kind: 'mutation' },
  brain: { path: 'intel.brain', kind: 'query' },
  syncSalesforce: { path: 'salesforce.fullSync', kind: 'mutation' },
} as const;

const server = new Server(
  { name: 'ai-crm-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

/**
 * Call one tRPC procedure over HTTP, in the wire format tRPC actually speaks.
 *
 * Queries go as GET with the input superjson-encoded on the query string; mutations
 * go as POST with it in the body. The result is unwrapped from its superjson envelope,
 * and a tRPC error is surfaced with its real message rather than a bare status.
 */
async function callTRPC(
  spec: { path: string; kind: 'query' | 'mutation' },
  input?: unknown
): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SESSION) headers.Cookie = `${COOKIE_NAME}=${SESSION}`;

  let url = `${TRPC_URL}/${spec.path}`;
  let body: string | undefined;

  if (spec.kind === 'query') {
    if (input !== undefined) {
      url += `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
    }
  } else {
    body = JSON.stringify({ json: input ?? null });
  }

  const response = await fetch(url, {
    method: spec.kind === 'query' ? 'GET' : 'POST',
    headers,
    body,
  });

  const payload = (await response.json().catch(() => null)) as any;

  if (!response.ok) {
    // tRPC puts the useful part in error.json.message; a bare status told you nothing.
    const detail =
      payload?.error?.json?.message ||
      payload?.error?.message ||
      `${response.status} ${response.statusText}`;
    if (response.status === 401) {
      throw new Error(
        `${detail} — the MCP server has no session. Run the app with DEMO_MODE=true, ` +
          `or set MCP_SESSION_COOKIE to a valid session cookie.`
      );
    }
    throw new Error(detail);
  }

  // superjson envelope: { result: { data: { json: <value> } } }
  return payload?.result?.data?.json ?? payload?.result?.data;
}

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_accounts',
      description:
        'List accounts with their intent scores, buying stage, industry, region and tech stack.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_account',
      description:
        'Get one account in full, including intent history and everything known about it.',
      inputSchema: {
        type: 'object',
        properties: { accountId: { type: 'number', description: 'Account ID' } },
        required: ['accountId'],
      },
    },
    {
      name: 'search_accounts',
      description:
        'Search accounts and contacts in natural language — "CISOs at fintechs with intent over 80".',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'What to look for' } },
        required: ['query'],
      },
    },
    {
      name: 'get_workspace_brain',
      description:
        'Executive summary of the whole book of business: totals, hot accounts, what changed, and what the workspace has learned.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'sync_salesforce',
      description:
        'Pull accounts and contacts from Salesforce into the CRM. Requires Salesforce credentials to be configured.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_accounts':
        return text(await callTRPC(PROCEDURES.listAccounts));

      case 'get_account': {
        const id = Number((args as any)?.accountId);
        if (!Number.isFinite(id)) throw new Error('accountId must be a number');
        return text(await callTRPC(PROCEDURES.getAccount, { id }));
      }

      case 'search_accounts': {
        const query = String((args as any)?.query || '').trim();
        if (!query) throw new Error('query is required');
        return text(await callTRPC(PROCEDURES.searchAccounts, { query }));
      }

      case 'get_workspace_brain':
        return text(await callTRPC(PROCEDURES.brain));

      // Was `import_salesforce`, and returned "import initiated" without doing
      // anything. This runs the sync the app itself runs, and reports what it did.
      case 'sync_salesforce':
        return text(await callTRPC(PROCEDURES.syncSalesforce));

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${error?.message || String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  await server.connect(new StdioServerTransport());
  console.error(`AI-CRM MCP server on stdio → ${TRPC_URL}`);
  if (!SESSION && process.env.DEMO_MODE !== 'true') {
    console.error(
      '[mcp] No MCP_SESSION_COOKIE and DEMO_MODE is not true — every tool will return 401.'
    );
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
