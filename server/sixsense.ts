/**
 * 6sense API Integration - LIVE
 * Company Firmographics API v3
 */

const SIXSENSE_API_KEY = process.env.SIXSENSE_API_KEY;
const SIXSENSE_API_URL = "https://api.6sense.com/v1/enrichment/company";

interface SixsenseCompanyData {
  company_name?: string;
  domain?: string;
  industry?: string;
  employee_range?: string;
  revenue_range?: string;
  country?: string;
  state?: string;
  city?: string;
  segments?: string[];
  // Note: Intent scores may not be in API response - they come from platform exports
}

/**
 * Fetch company firmographics from 6sense by domain
 */
export async function getCompanyByDomain(domain: string): Promise<SixsenseCompanyData | null> {
  if (!SIXSENSE_API_KEY) {
    console.warn("[6sense] API key not configured");
    return null;
  }

  if (!domain) {
    console.warn("[6sense] Domain is required");
    return null;
  }

  try {
    // 6sense API uses form-urlencoded
    const formData = new URLSearchParams();
    formData.append('domain', domain);

    const response = await fetch(SIXSENSE_API_URL, {
      method: 'POST',
      headers: {
        "Authorization": `Token ${SIXSENSE_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (!response.ok) {
      console.error(`[6sense] API error for domain ${domain}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[6sense] Failed to fetch company data for ${domain}:`, error);
    return null;
  }
}

/**
 * Fetch company firmographics by email
 */
export async function getCompanyByEmail(email: string): Promise<SixsenseCompanyData | null> {
  if (!SIXSENSE_API_KEY) {
    console.warn("[6sense] API key not configured");
    return null;
  }

  if (!email) {
    console.warn("[6sense] Email is required");
    return null;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('email', email);

    const response = await fetch(SIXSENSE_API_URL, {
      method: 'POST',
      headers: {
        "Authorization": `Token ${SIXSENSE_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (!response.ok) {
      console.error(`[6sense] API error for email ${email}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[6sense] Failed to fetch company data for ${email}:`, error);
    return null;
  }
}

/**
 * Get enriched company data for an account
 * Note: Intent scores are not in the API - they come from our database or platform exports
 */
export async function enrichAccount(domain: string) {
  const companyData = await getCompanyByDomain(domain);
  
  if (!companyData) {
    return null;
  }

  return {
    companyName: companyData.company_name,
    domain: companyData.domain,
    industry: companyData.industry,
    employeeRange: companyData.employee_range,
    revenueRange: companyData.revenue_range,
    country: companyData.country,
    state: companyData.state,
    city: companyData.city,
    segments: companyData.segments || []
  };
}
