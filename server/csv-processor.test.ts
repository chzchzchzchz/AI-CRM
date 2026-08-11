import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockAuthContext } from "./test-utils";

describe("CSV Processor", () => {
  describe("getTemplateInfo", () => {
    it("should return template fields, status options, and contact owners", async () => {
      // Import the router directly to test
      const { csvProcessorRouter } = await import("./csv-processor-router");
      
      // Create a mock caller with authenticated context
      const caller = csvProcessorRouter.createCaller(mockAuthContext);
      
      const result = await caller.getTemplateInfo();
      
      // Check fields exist
      expect(result.fields).toBeDefined();
      expect(Array.isArray(result.fields)).toBe(true);
      expect(result.fields.length).toBeGreaterThan(0);
      
      // Check required fields are present
      const fieldNames = result.fields.map((f: { name: string }) => f.name);
      expect(fieldNames).toContain("Email");
      expect(fieldNames).toContain("First Name");
      expect(fieldNames).toContain("Last Name");
      expect(fieldNames).toContain("Company");
      expect(fieldNames).toContain("Recent Event");
      
      // Check status options
      expect(result.statusOptions).toBeDefined();
      expect(Array.isArray(result.statusOptions)).toBe(true);
      expect(result.statusOptions).toContain("Registered");
      expect(result.statusOptions).toContain("Attended webinar");
      expect(result.statusOptions).toContain("Met with sales");
      
      // Check contact owners
      expect(result.contactOwners).toBeDefined();
      expect(Array.isArray(result.contactOwners)).toBe(true);
      expect(result.contactOwners).toContain("Alex Rivera");
      expect(result.contactOwners).toContain("Jordan Bailey");
    });
  });

  describe("analyzeAndMap", () => {
    // Skip this test as it requires external LLM API call which times out in test environment
    it.skip("should map common CSV headers to template fields", async () => {
      const { csvProcessorRouter } = await import("./csv-processor-router");
      const caller = csvProcessorRouter.createCaller(mockAuthContext);
      
      const sourceHeaders = [
        "email_address",
        "first_name", 
        "last_name",
        "company_name",
        "job_title",
        "phone"
      ];
      
      const sampleRows = [
        {
          "email_address": "john@example.com",
          "first_name": "John",
          "last_name": "Doe",
          "company_name": "Acme Corp",
          "job_title": "CISO",
          "phone": "555-1234"
        }
      ];
      
      const result = await caller.analyzeAndMap({
        sourceHeaders,
        sampleRows,
        eventName: "2025-01-15-WBN-Test",
        defaultStatus: "Registered"
      });
      
      expect(result.success).toBe(true);
      expect(result.mappings).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.eventName).toBe("2025-01-15-WBN-Test");
      expect(result.defaultStatus).toBe("Registered");
    });
  });

  describe("processData", () => {
    it("should transform data according to mappings", async () => {
      const { csvProcessorRouter } = await import("./csv-processor-router");
      const caller = csvProcessorRouter.createCaller(mockAuthContext);
      
      const rows = [
        {
          "email": "jane@example.com",
          "fname": "Jane",
          "lname": "Smith",
          "company": "Test Inc",
          "country": "US"
        },
        {
          "email": "bob@example.com",
          "fname": "Bob",
          "lname": "Jones",
          "company": "Demo LLC",
          "country": "United States"
        }
      ];
      
      const mappings = {
        "Email": "email",
        "First Name": "fname",
        "Last Name": "lname",
        "Company": "company",
        "Country": "country"
      };
      
      const transformations = [
        {
          field: "Country",
          type: "country_expand",
          description: "Expand country abbreviations"
        }
      ];
      
      const result = await caller.processData({
        rows,
        mappings,
        transformations,
        eventName: "2025-01-15-WBN-Test",
        defaultStatus: "Attended webinar",
        contactOwner: "Alex Rivera"
      });
      
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.csvContent).toBeDefined();
      expect(result.csvContent).toContain("2025-01-15-WBN-Test");
      expect(result.csvContent).toContain("Attended webinar");
      expect(result.csvContent).toContain("jane@example.com");
      expect(result.preview).toBeDefined();
      expect(result.preview.length).toBeLessThanOrEqual(5);
    });

    it("normalizes any non-header value the model writes for an unmatched field to null", async () => {
      // The prompt used to tell the model to write the literal string "UNMAPPED" for a
      // field with no match. The client's <Select> only recognizes `null` as "not
      // mapped" — any other value (even "UNMAPPED") matches no <SelectItem> and the
      // dropdown renders blank instead of "-- Not mapped --". Simulate a model response
      // that still does this (or hallucinates some other non-header string) and confirm
      // the router normalizes it to null regardless of what the model wrote.
      vi.resetModules();
      vi.doMock("./_core/llm", async (importOriginal) => {
        const actual = await importOriginal<typeof import("./_core/llm")>();
        return {
          ...actual,
          invokeLLM: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                role: "assistant",
                content: JSON.stringify({
                  mappings: {
                    "First Name": "fname",
                    "Email": "email_address",
                    "Company": "UNMAPPED",
                    "Revenue": "some_field_the_model_made_up",
                  },
                  transformations: [],
                  warnings: [],
                  confidence: 0.9,
                }),
              },
            }],
          }),
        };
      });

      const { csvProcessorRouter } = await import("./csv-processor-router");
      const caller = csvProcessorRouter.createCaller(mockAuthContext);

      const result = await caller.analyzeAndMap({
        sourceHeaders: ["fname", "email_address"],
        sampleRows: [{ fname: "Jane", email_address: "jane@example.com" }],
        eventName: "Test",
        defaultStatus: "Registered",
      });

      expect(result.mappings["First Name"]).toBe("fname");
      expect(result.mappings["Email"]).toBe("email_address");
      // Neither "UNMAPPED" nor a hallucinated header survives normalization.
      expect(result.mappings["Company"]).toBeNull();
      expect(result.mappings["Revenue"]).toBeNull();

      vi.doUnmock("./_core/llm");
      vi.resetModules();
    });

    it("should apply country transformation correctly", async () => {
      const { csvProcessorRouter } = await import("./csv-processor-router");
      const caller = csvProcessorRouter.createCaller(mockAuthContext);
      
      const rows = [
        { "country": "US" },
        { "country": "usa" },
        { "country": "CA" },
        { "country": "UK" }
      ];
      
      const mappings = {
        "Country": "country"
      };
      
      const transformations = [
        {
          field: "Country",
          type: "country_expand",
          description: "Expand country abbreviations"
        }
      ];
      
      const result = await caller.processData({
        rows,
        mappings,
        transformations,
        eventName: "Test",
        defaultStatus: "Registered"
      });
      
      expect(result.success).toBe(true);
      // Check that US was expanded to United States
      expect(result.csvContent).toContain("United States");
      expect(result.csvContent).toContain("Canada");
      expect(result.csvContent).toContain("United Kingdom");
    });
  });

  describe("analyzeAndMap — degraded (no LLM reachable)", () => {
    const savedEnv = {
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      BUILT_IN_FORGE_API_KEY: process.env.BUILT_IN_FORGE_API_KEY,
      LOCAL_LLM_URL: process.env.LOCAL_LLM_URL,
      LLM_TOTAL_DEADLINE_MS: process.env.LLM_TOTAL_DEADLINE_MS,
      LLM_REQUEST_TIMEOUT_MS: process.env.LLM_REQUEST_TIMEOUT_MS,
    };

    beforeEach(() => {
      // Force the unavailable path: no hosted key, unreachable local model, short
      // deadline — so this test never hangs waiting on a real network call.
      process.env.OPENROUTER_API_KEY = "";
      process.env.BUILT_IN_FORGE_API_KEY = "";
      process.env.LOCAL_LLM_URL = "http://127.0.0.1:1";
      process.env.LLM_TOTAL_DEADLINE_MS = "2000";
      process.env.LLM_REQUEST_TIMEOUT_MS = "2000";
    });

    afterEach(() => {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("falls back to heuristic mapping and says so, instead of failing silently or hanging", async () => {
      const { csvProcessorRouter } = await import("./csv-processor-router");
      const caller = csvProcessorRouter.createCaller(mockAuthContext);

      const result = await caller.analyzeAndMap({
        sourceHeaders: ["first_name", "last_name", "email_address", "company_name"],
        sampleRows: [{
          first_name: "Jane", last_name: "Doe",
          email_address: "jane@example.com", company_name: "Acme Corp",
        }],
        eventName: "Test",
        defaultStatus: "Registered",
      });

      // Still reports success (the UI can proceed with a manual/heuristic mapping),
      // but is honest that the AI pass didn't run — never a silent, unexplained result.
      expect(result.success).toBe(true);
      expect(result.warnings.join(" ")).toMatch(/AI mapping failed/i);
      expect(result.mappings["First Name"]).toBe("first_name");
      expect(result.mappings["Last Name"]).toBe("last_name");
      expect(result.mappings["Email"]).toBe("email_address");
      expect(result.mappings["Company"]).toBe("company_name");
    }, 15_000);
  });
});
