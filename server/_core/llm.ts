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

// Ordered provider chain, tried top to bottom until one answers. Every configured option
// is a real fallback, so a saturated hosted tier degrades to the local model rather than
// to nothing:
//   1. OpenRouter when OPENROUTER_API_KEY is set (fast hosted; free models are flaky).
//   2. Manus Forge gateway when BUILT_IN_FORGE_API_KEY is set.
//   3. Local Ollama (OpenAI-compatible, no auth) — always last, free, and always tried.
const resolveProviders = (): LLMProvider[] => {
  const providers: LLMProvider[] = [];

  if (ENV.openrouterApiKey && ENV.openrouterApiKey.trim().length > 0) {
    providers.push({
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: ENV.openrouterApiKey,
      model: ENV.openrouterModel,
      isForge: false,
      isOpenRouter: true,
    });
  }

  if (ENV.forgeApiKey && ENV.forgeApiKey.trim().length > 0) {
    providers.push({
      url:
        ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
          ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
          : "https://forge.manus.im/v1/chat/completions",
      apiKey: ENV.forgeApiKey,
      model: "gemini-2.5-flash",
      isForge: true,
    });
  }

  if (ENV.localLlmUrl && ENV.localLlmUrl.trim().length > 0) {
    providers.push({
      url: `${ENV.localLlmUrl.replace(/\/$/, "")}/chat/completions`,
      apiKey: "ollama", // ignored by Ollama; kept non-empty for OpenAI-compatible clients
      model: ENV.localLlmModel,
      isForge: false,
    });
  }

  return providers;
};

// Hard ceiling on a single request. Without this a rate-limited provider can stall an
// interactive request (an account brief, a chat reply) for minutes.
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_REQUEST_TIMEOUT_MS || 45_000);

// Hard ceiling on the WHOLE call, across every provider and fallback model. Per-request
// timeouts alone still stack: three providers that each hang for REQUEST_TIMEOUT_MS add up
// to minutes of dead air. Once this deadline passes we stop trying and degrade.
const TOTAL_DEADLINE_MS = Number(process.env.LLM_TOTAL_DEADLINE_MS || 60_000);

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
  const providers = resolveProviders();

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

  const normalizedMessages = messages.map(normalizeMessage);
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  // Built per provider: Forge takes a far larger budget and supports strict json_schema,
  // while local/hosted OSS models need a smaller budget and plain json_object.
  const payloadFor = (p: LLMProvider, model: string): Record<string, unknown> => {
    const payload: Record<string, unknown> = { model, messages: normalizedMessages };

    if (tools && tools.length > 0) payload.tools = tools;
    if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

    payload.max_tokens = p.isForge ? 32768 : 2048;
    if (p.isForge) payload.thinking = { budget_tokens: 128 };

    if (normalizedResponseFormat) {
      // Smaller models are unreliable with strict json_schema; ask for json_object instead.
      payload.response_format =
        !p.isForge && normalizedResponseFormat.type === "json_schema"
          ? { type: "json_object" }
          : normalizedResponseFormat;
    }

    return payload;
  };

  const deadline = Date.now() + TOTAL_DEADLINE_MS;
  const timeLeft = () => deadline - Date.now();

  const doFetch = (p: LLMProvider, model: string) =>
    fetch(p.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${p.apiKey}`,
        ...(p.isOpenRouter
          ? { "HTTP-Referer": "https://targetdash.app", "X-Title": "TargetDash" }
          : {}),
      },
      body: JSON.stringify(payloadFor(p, model)),
      // Never wait past the overall deadline, even if the per-request budget is larger.
      signal: AbortSignal.timeout(Math.max(1_000, Math.min(REQUEST_TIMEOUT_MS, timeLeft()))),
    });

  let lastError = "";
  let sawForge = false;

  for (const provider of providers) {
    if (provider.isForge) sawForge = true;
    if (timeLeft() <= 0) break;

    // OpenRouter free models rotate through rate limits, so its model setting may be a
    // comma-separated fallback list — try each in order before moving to the next provider.
    const models = provider.isOpenRouter
      ? provider.model.split(",").map((m) => m.trim()).filter(Boolean)
      : [provider.model];

    for (const model of models) {
      if (timeLeft() <= 0) {
        lastError = lastError || `no provider responded within ${TOTAL_DEADLINE_MS}ms`;
        break;
      }
      let response: Response;
      try {
        response = await doFetch(provider, model);
        // One short retry on 429, then move on. Waiting out a long Retry-After here would
        // stall the caller; the next model or provider is almost always faster.
        if (provider.isOpenRouter && response.status === 429) {
          const retryAfter = Math.min(parseInt(response.headers.get("retry-after") || "3"), 5);
          if (retryAfter * 1000 < timeLeft()) {
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            response = await doFetch(provider, model);
          }
        }
      } catch (err) {
        // Unreachable or timed out (no Ollama running, provider stalled) — try the next one.
        lastError = `${provider.url}: ${(err as Error)?.message || "request failed"}`;
        continue;
      }

      // Body reads can abort too (the timeout signal is still armed). Keep them inside the
      // guarded path so a stalled read falls through to the next provider instead of
      // escaping invokeLLM and crashing the caller.
      try {
        if (response.ok) return (await response.json()) as InvokeResult;
        lastError = `${provider.url} (${model}): ${response.status} ${response.statusText} – ${await response.text()}`;
      } catch (err) {
        lastError = `${provider.url} (${model}): response body read failed – ${(err as Error)?.message}`;
        continue;
      }
      // Auth/quota problems affect every model on this provider — stop trying its list.
      if (response.status === 401 || response.status === 403 || response.status === 402) break;
    }
  }

  // Every provider failed. Forge is the only configuration expected to be authoritative,
  // so surface a hard error there; otherwise degrade so AI features never crash the app.
  if (!sawForge) {
    console.error(`[llm] all providers failed. Last error: ${lastError}`);
    return llmUnavailableFallback(normalizedResponseFormat);
  }
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
