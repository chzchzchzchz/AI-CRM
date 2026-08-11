import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression coverage for a real bug found while exercising /validation against the
 * live dev server: verifyCompanyDomain/verifyEmployeeCount/verifyContactEmployment
 * scrape a public search results page (no search API key is configured for this app).
 * Google's result markup no longer matches the old `BNeawe`-class snippet regex, so a
 * real 200-OK response with real HTML produced zero snippets and a "Found domains: ..."
 * string built entirely from Google's own chrome links (www.google.com,
 * support.google.com) — never from an actual search result.
 *
 * That garbage "evidence" still got handed to the model as if it were real, and the
 * model dutifully rendered a confident, wrong verdict (observed live: a 0.85-confidence
 * "critical" domain-mismatch finding against a correct domain). These tests pin the
 * fix: no usable evidence must short-circuit before the model is ever asked to judge.
 */

const boilerplateOnlyHtml = `
<html><body>
<a href="https://www.google.com/preferences">Settings</a>
<a href="https://support.google.com/websearch">Help</a>
</body></html>`;

const htmlWithRealEvidence = `
<html><body>
<div class="BNeawe vvjwJb AP7Wnd">Acme Corp is a leading widget maker headquartered at acme.com</div>
<div class="BNeawe s3v9rd AP7Wnd">Acme Corp - Official Site - acme.com - Widgets since 1990</div>
<a href="https://acme.com/about">About Acme</a>
</body></html>`;

describe("dataValidation — web search evidence honesty", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.doUnmock("./_core/llm");
    vi.resetModules();
  });

  it("does not fabricate a domain-mismatch finding when the scrape returns only the search engine's own boilerplate links", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => boilerplateOnlyHtml,
    }) as any;

    const invokeLLM = vi.fn();
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return { ...actual, invokeLLM };
    });

    const { validateAccount, resetSearchEvidenceStats, searchEvidenceStats } = await import("./dataValidation");
    resetSearchEvidenceStats();

    const issues = await validateAccount({
      id: 1,
      name: "Acme Corp",
      domain: "acme.com",
      employeeCount: 500,
      intentScore: 50,
    });

    // No search evidence -> no verdict rendered at all, not even a low-confidence one.
    expect(issues.filter(i => i.field === "domain")).toHaveLength(0);
    expect(issues.filter(i => i.field === "employeeCount")).toHaveLength(0);
    // The model was never asked to guess from nothing.
    expect(invokeLLM).not.toHaveBeenCalled();
    // And the run honestly recorded that it couldn't check, rather than looking clean.
    expect(searchEvidenceStats.checked).toBeGreaterThan(0);
    expect(searchEvidenceStats.noEvidence).toBe(searchEvidenceStats.checked);
  });

  it("does not fabricate a finding when the scrape fails outright (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET")) as any;

    const invokeLLM = vi.fn();
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return { ...actual, invokeLLM };
    });

    const { validateAccount, resetSearchEvidenceStats } = await import("./dataValidation");
    resetSearchEvidenceStats();

    const issues = await validateAccount({
      id: 2, name: "Widgets Inc", domain: "widgetsinc.com", employeeCount: 200, intentScore: 10,
    });

    expect(issues).toHaveLength(0);
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("still runs the AI check when the scrape returns real evidence", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlWithRealEvidence,
    }) as any;

    const invokeLLM = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          role: "assistant",
          content: JSON.stringify({ isValid: true, confidence: 0.9, issue: "", suggestion: "" }),
        },
      }],
    });
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return { ...actual, invokeLLM };
    });

    const { validateAccount, resetSearchEvidenceStats, searchEvidenceStats } = await import("./dataValidation");
    resetSearchEvidenceStats();

    const issues = await validateAccount({
      id: 3, name: "Acme Corp", domain: "acme.com", employeeCount: null, intentScore: 20,
    });

    // Real evidence -> the model was actually consulted, and (isValid: true) -> no issue.
    expect(invokeLLM).toHaveBeenCalled();
    expect(issues.filter(i => i.field === "domain")).toHaveLength(0);
    expect(searchEvidenceStats.noEvidence).toBe(0);
  });
});
