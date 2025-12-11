import { describe, expect, it } from "vitest";

describe("6sense API Integration", () => {
  it("validates 6sense API key by fetching company data", async () => {
    const apiKey = process.env.SIXSENSE_API_KEY;
    
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    
    // Test API call to 6sense Company Identification API
    // Using a test IP address (8.8.8.8 - Google DNS)
    const response = await fetch(
      "https://epsilon.6sense.com/v3/company/details?ip=8.8.8.8",
      {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      }
    );
    
    // 6sense should return 200 or 401 (if key is invalid)
    expect(response.status).not.toBe(401);
    expect(response.status).toBeLessThan(500);
  });
});
