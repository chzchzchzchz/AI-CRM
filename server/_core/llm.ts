import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

type LLMProvider = { url: string; apiKey: string; model: string; isForge: boolean; isOpenRouter?: boolean };

// Provider resolution with a FREE, no-key fallback so the AI works with zero paid keys:
//   1. Manus Forge gateway when BUILT_IN_FORGE_API_KEY is set (best quality; hosted deploys).
//   2. Local Ollama (OpenAI-compatible, no auth) — free automation for anyone running
//      `ollama serve`. Configurable via LOCAL_LLM_URL / LOCAL_LLM_MODEL.
const resolveProvider = (): LLMProvider => {
  if (ENV.openrouterApiKey && ENV.openrouterApiKey.trim().length > 0) {
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: ENV.openrouterApiKey,
      model: ENV.openrouterModel,
      isForge: false,
      isOpenRouter: true,
    };
  }
  if (ENV.forgeApiKey && ENV.forgeApiKey.trim().length > 0) {
    return {
      url:
        ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
          ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
          : "https://forge.manus.im/v1/chat/completions",
      apiKey: ENV.forgeApiKey,
      model: "gemini-2.5-flash",
      isForge: true,
    };
  }
  return {
    url: `${ENV.localLlmUrl.replace(/\/$/, "")}/chat/completions`,
    apiKey: "ollama", // ignored by Ollama; kept non-empty for OpenAI-compatible clients
    model: ENV.localLlmModel,
    isForge: false,
  };
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const provider = resolveProvider();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: provider.model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = provider.isForge ? 32768 : 2048;
  if (provider.isForge) {
    payload.thinking = { "budget_tokens": 128 };
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    // Local models are unreliable with strict json_schema; ask for json_object instead.
    payload.response_format =
      !provider.isForge && normalizedResponseFormat.type === "json_schema"
        ? { type: "json_object" }
        : normalizedResponseFormat;
  }

  const doFetch = (model: string) => fetch(provider.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
      ...(provider.isOpenRouter
        ? { "HTTP-Referer": "https://targetdash.app", "X-Title": "TargetDash" }
        : {}),
    },
    body: JSON.stringify({ ...payload, model }),
  });

  // OpenRouter free models rotate through rate limits, so provider.model may be a
  // comma-separated fallback list — try each in order and fall through on 429/unavailable.
  const models = provider.isOpenRouter
    ? provider.model.split(",").map((m) => m.trim()).filter(Boolean)
    : [provider.model];

  let response: Response | undefined;
  let lastError = "";
  for (const model of models) {
    try {
      response = await doFetch(model);
      // Retry a couple times on 429, respecting Retry-After (capped), before moving on.
      for (let attempt = 0; provider.isOpenRouter && response.status === 429 && attempt < 2; attempt++) {
        const retryAfter = Math.min(parseInt(response.headers.get("retry-after") || "5"), 20);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        response = await doFetch(model);
      }
    } catch (err) {
      // Provider unreachable (e.g. no Ollama running). In keyless/local mode, degrade
      // gracefully so AI features never crash a brand-new user's app.
      if (!provider.isForge) return llmUnavailableFallback(normalizedResponseFormat);
      throw err;
    }

    if (response.ok) return (await response.json()) as InvokeResult;
    lastError = `${response.status} ${response.statusText} – ${await response.text()}`;
    // 429 (rate-limited) / 404 (model gone) → try the next fallback model.
    if (!provider.isOpenRouter || (response.status !== 429 && response.status !== 404)) break;
  }

  if (!provider.isForge) return llmUnavailableFallback(normalizedResponseFormat);
  throw new Error(`LLM invoke failed: ${lastError}`);
}

// Returned when no LLM is available at all (no key + no local Ollama). Keeps the AI
// features functional-but-honest for a zero-install user instead of erroring out.
function llmUnavailableFallback(
  responseFormat: { type: string } | undefined
): InvokeResult {
  const note =
    "AI generation is unavailable right now: no API key is set and no local model is reachable. " +
    "To enable free local AI: install Ollama, run `ollama serve`, then `ollama pull phi3:mini`. " +
    "Or set BUILT_IN_FORGE_API_KEY for hosted AI.";
  const isJson =
    responseFormat?.type === "json_object" ||
    responseFormat?.type === "json_schema";
  const content = isJson ? JSON.stringify({ available: false, note }) : note;
  return {
    choices: [{ message: { role: "assistant", content } }],
  } as unknown as InvokeResult;
}
