// Dust integration service

// Dust configuration - API key should be in environment variables
const DUST_WORKSPACE_ID = process.env.DUST_WORKSPACE_ID || "ASiAFMZt5a";
const DUST_API_KEY = process.env.DUST_API_KEY || "";
const DUST_BASE_URL = `https://dust.tt/api/v1/w/${DUST_WORKSPACE_ID}`;

// Log warning if API key is not configured
if (!DUST_API_KEY) {
  console.warn("[Dust] DUST_API_KEY not configured in environment variables");
}

export interface DustQueryOptions {
  assistant?: "dust" | "deep-dive" | "gpt-5-nano" | "gpt-5";
  timeout?: number;
  maxRetries?: number;
}

/**
 * Query Dust knowledge base for account/contact intelligence
 * Dust is fed HubSpot data, so queries can search for HubSpot records
 */
export async function queryDust(
  query: string,
  options: DustQueryOptions = {}
): Promise<string> {
  const {
    assistant = "gpt-5-nano",
    timeout = 120000,
    maxRetries = 3,
  } = options;

  try {
    const response = await fetch(`${DUST_BASE_URL}/assistant/conversations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DUST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          content: query,
          mentions: [{ configurationId: assistant }],
          context: {
            timezone: "UTC",
            origin: "api",
            username: "dashboard",
            fullName: "Target Account Dashboard",
          },
        },
        blocking: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.error?.type === "plan_message_limit_exceeded") {
        throw new Error("DUST_RATE_LIMIT");
      }
      throw new Error(`Dust API error: ${response.status}`);
    }

    const data = await response.json();
    const conversationId = data.conversation.sId;

    // Poll for response
    return await pollDustResponse(conversationId, timeout);
  } catch (error) {
    if (error instanceof Error && error.message === "DUST_RATE_LIMIT") {
      throw error;
    }
    throw new Error(`Dust query failed: ${error}`);
  }
}

/**
 * Poll Dust conversation for response
 */
async function pollDustResponse(
  conversationId: string,
  timeout: number
): Promise<string> {
  const pollUrl = `${DUST_BASE_URL}/assistant/conversations/${conversationId}`;
  const startTime = Date.now();
  const pollInterval = 4000; // 4 seconds
  const maxPolls = Math.ceil(timeout / pollInterval);

  for (let i = 0; i < maxPolls; i++) {
    if (Date.now() - startTime > timeout) {
      throw new Error("Dust query timeout");
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const response = await fetch(pollUrl, {
        headers: {
          Authorization: `Bearer ${DUST_API_KEY}`,
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.conversation?.content || [];

      if (content.length > 1 && content[1]?.[0]) {
        const message = content[1][0];
        const status = message.status;

        if (status === "succeeded") {
          return message.content || "";
        } else if (status === "failed") {
          throw new Error(`Dust query failed: ${message.error}`);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("failed")) {
        throw error;
      }
      // Continue polling on network errors
      continue;
    }
  }

  throw new Error("Dust query timeout - no response received");
}

/**
 * Generate account intelligence by querying Dust for HubSpot data
 */
export async function generateAccountIntelligence(
  accountName: string,
  accountDetails: string
): Promise<string> {
  const query = `Search HubSpot for information about ${accountName}. Include:
1. Company overview and recent activity
2. Key contacts and decision makers
3. Recent interactions or calls
4. Deal information if available
5. Any notes or custom fields

Format as a structured intelligence brief for sales.`;

  return queryDust(query, { assistant: "gpt-5-nano" });
}

/**
 * Generate contact intelligence by querying Dust for HubSpot data
 */
export async function generateContactIntelligence(
  contactName: string,
  contactEmail: string,
  companyName: string
): Promise<string> {
  const query = `Search HubSpot for information about ${contactName} (${contactEmail}) at ${companyName}. Include:
1. Contact profile and role
2. Recent interactions
3. Communication history
4. Related deals
5. Any notes or custom fields

Format as a structured contact brief for sales.`;

  return queryDust(query, { assistant: "gpt-5-nano" });
}

/**
 * Search Gong calls in Dust knowledge base
 */
export async function searchGongCalls(
  accountName: string,
  contactName?: string
): Promise<string> {
  const query = contactName
    ? `Find all Gong call transcripts for ${contactName} at ${accountName}. Extract:
1. Call dates and participants
2. Key discussion points
3. Pain points mentioned
4. Next steps agreed
5. Any pricing discussions`
    : `Find all Gong call transcripts for ${accountName}. Extract:
1. Call dates and participants
2. Key discussion points
3. Pain points mentioned
4. Next steps agreed
5. Any pricing discussions`;

  return queryDust(query, { assistant: "dust" });
}
