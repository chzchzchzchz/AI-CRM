import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isZoomInfoConfigured,
  resetZoomInfoToken,
  zoominfoEnrichCompany,
  zoominfoSearchContacts,
  zoominfoEnrichContact,
} from "./integrations/zoominfo";

const ENV_KEYS = [
  "ZOOMINFO_USERNAME",
  "ZOOMINFO_PASSWORD",
  "ZOOMINFO_CLIENT_ID",
  "ZOOMINFO_PRIVATE_KEY",
] as const;

let savedEnv: Record<string, string | undefined>;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  ENV_KEYS.forEach(k => delete process.env[k]);
  resetZoomInfoToken();
  vi.restoreAllMocks();
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetZoomInfoToken();
  vi.restoreAllMocks();
});

describe("ZoomInfo connector", () => {
  describe("configuration", () => {
    it("is not configured when no credentials are present", () => {
      expect(isZoomInfoConfigured()).toBe(false);
    });

    it("accepts username + password", () => {
      process.env.ZOOMINFO_USERNAME = "u";
      process.env.ZOOMINFO_PASSWORD = "p";
      expect(isZoomInfoConfigured()).toBe(true);
    });

    it("accepts PKI credentials", () => {
      process.env.ZOOMINFO_USERNAME = "u";
      process.env.ZOOMINFO_CLIENT_ID = "cid";
      process.env.ZOOMINFO_PRIVATE_KEY = "key";
      expect(isZoomInfoConfigured()).toBe(true);
    });

    it("skips rather than throws when unconfigured, so the app runs without it", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await zoominfoEnrichCompany({ domain: "vertexcloud.com" });
      expect(res.ok).toBe(false);
      expect(res.skipped).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("token lifecycle", () => {
    beforeEach(() => {
      process.env.ZOOMINFO_USERNAME = "u";
      process.env.ZOOMINFO_PASSWORD = "p";
    });

    it("authenticates once and reuses the JWT across calls", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).endsWith("/authenticate")) return jsonResponse({ jwt: "tok-1" });
        return jsonResponse({ data: { result: [{ data: [{ name: "Vertex" }] }] } });
      });

      await zoominfoEnrichCompany({ domain: "vertexcloud.com" });
      await zoominfoEnrichCompany({ domain: "pinnaclesw.com" });

      const authCalls = fetchSpy.mock.calls.filter(c => String(c[0]).endsWith("/authenticate"));
      expect(authCalls).toHaveLength(1);
    });

    it("re-authenticates once when the cached token is rejected", async () => {
      let dataCalls = 0;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).endsWith("/authenticate")) return jsonResponse({ jwt: `tok-${Date.now()}` });
        dataCalls += 1;
        // First data call rejects the token; the retry succeeds.
        if (dataCalls === 1) return jsonResponse({ message: "expired" }, 401);
        return jsonResponse({ data: { result: [{ data: [{ name: "Vertex" }] }] } });
      });

      const res = await zoominfoEnrichCompany({ domain: "vertexcloud.com" });

      expect(res.ok).toBe(true);
      expect(res.data?.name).toBe("Vertex");
      const authCalls = fetchSpy.mock.calls.filter(c => String(c[0]).endsWith("/authenticate"));
      expect(authCalls).toHaveLength(2);
    });

    it("surfaces an authentication failure instead of retrying forever", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ message: "bad credentials" }, 401),
      );
      const res = await zoominfoEnrichCompany({ domain: "vertexcloud.com" });
      expect(res.ok).toBe(false);
      expect(res.error).toContain("bad credentials");
    });
  });

  describe("company enrichment", () => {
    beforeEach(() => {
      process.env.ZOOMINFO_USERNAME = "u";
      process.env.ZOOMINFO_PASSWORD = "p";
    });

    it("requires a domain or a name", async () => {
      const res = await zoominfoEnrichCompany({});
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/domain or name/i);
    });

    it("maps a match onto the flat company shape", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).endsWith("/authenticate")) return jsonResponse({ jwt: "tok" });
        return jsonResponse({
          data: {
            result: [
              {
                data: [
                  {
                    id: 42,
                    name: "Vertex Cloud Systems",
                    website: "vertexcloud.com",
                    employeeCount: 1500,
                    technologies: [{ name: "Okta" }, { name: "Snowflake" }],
                  },
                ],
              },
            ],
          },
        });
      });

      const res = await zoominfoEnrichCompany({ domain: "vertexcloud.com" });
      expect(res.ok).toBe(true);
      expect(res.data).toMatchObject({
        id: 42,
        name: "Vertex Cloud Systems",
        employeeCount: 1500,
      });
      expect(res.data?.technologies).toEqual(["Okta", "Snowflake"]);
    });

    it("returns ok with no data when ZoomInfo has no match", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).endsWith("/authenticate")) return jsonResponse({ jwt: "tok" });
        return jsonResponse({ data: { result: [] } });
      });

      const res = await zoominfoEnrichCompany({ domain: "nope.example" });
      expect(res.ok).toBe(true);
      expect(res.data).toBeUndefined();
    });
  });

  describe("contact search", () => {
    beforeEach(() => {
      process.env.ZOOMINFO_USERNAME = "u";
      process.env.ZOOMINFO_PASSWORD = "p";
    });

    it("requires a company domain", async () => {
      const res = await zoominfoSearchContacts({ companyDomain: "" });
      expect(res.ok).toBe(false);
    });

    it("clamps the page size to ZoomInfo's maximum", async () => {
      let sentBody: any;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any, init: any) => {
        if (String(url).endsWith("/authenticate")) return jsonResponse({ jwt: "tok" });
        sentBody = JSON.parse(init.body);
        return jsonResponse({ data: [] });
      });

      await zoominfoSearchContacts({ companyDomain: "vertexcloud.com", limit: 5000 });
      expect(sentBody.rpp).toBe(100);
    });

    it("returns the mapped contact rows", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).endsWith("/authenticate")) return jsonResponse({ jwt: "tok" });
        return jsonResponse({
          data: [{ id: 7, firstName: "Nina", lastName: "Khan", jobTitle: "CRO" }],
        });
      });

      const res = await zoominfoSearchContacts({ companyDomain: "vertexcloud.com" });
      expect(res.ok).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data?.[0]).toMatchObject({ firstName: "Nina", jobTitle: "CRO" });
    });
  });

  describe("contact enrichment", () => {
    it("requires an email", async () => {
      process.env.ZOOMINFO_USERNAME = "u";
      process.env.ZOOMINFO_PASSWORD = "p";
      const res = await zoominfoEnrichContact("");
      expect(res.ok).toBe(false);
    });
  });
});
