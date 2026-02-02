import { describe, expect, it } from "vitest";

describe("6sense API Integration", () => {
  it("validates 6sense API key by fetching company data", async () => {
    const apiKey = process.env.SIXSENSE_API_KEY;
    
    // Skip test if no API key configured
    if (!apiKey) {
      console.log("Skipping 6sense test - no API key configured");
      return;
    }
    
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    
    // Test API call to 6sense Company Identification API
    // Using a test IP address (8.8.8.8 - Google DNS)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(
        "https://epsilon.6sense.com/v3/company/details?ip=8.8.8.8",
        {
          headers: {
            Authorization: `Token ${apiKey}`,
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      // 6sense should return 200 or 401 (if key is invalid)
      expect(response.status).not.toBe(401);
      expect(response.status).toBeLessThan(500);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      // Network errors are acceptable in test environment
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("6sense API request timed out - skipping");
        return;
      }
      throw error;
    }
  }, 15000); // 15 second timeout
});
