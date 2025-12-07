import { describe, expect, it } from "vitest";

describe("6sense API Integration", () => {
  it("validates 6sense API key by fetching company data", async () => {
    const apiKey = process.env.SIXSENSE_API_KEY;
    
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    
    // Test API call to 6sense
    const response = await fetch("https://api.6sense.com/v1/company/identify", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        domain: "microsoft.com"
      })
    });
    
    // 6sense should return 200 or 401 (if key is invalid)
    expect(response.status).not.toBe(401);
    expect(response.status).toBeLessThan(500);
  });
});
