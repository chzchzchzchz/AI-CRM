/**
 * Gemini Automation - NOT IMPLEMENTED
 *
 * This was a browser-automation approach that needed Playwright, which isn't installed.
 * It throws rather than returning a placeholder string, so callers report the feature as
 * unavailable instead of presenting "not available" text to the user as if it were research.
 * Deployers who want Gemini research should use the main LLM layer (OpenRouter/Forge/Ollama)
 * or wire a Gemini API key.
 */
export async function queryGemini(_prompt: string): Promise<string> {
  throw new Error(
    "Gemini automation is not available in this deployment. Use the configured LLM provider (see .env) for AI research."
  );
}
