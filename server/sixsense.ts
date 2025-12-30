/**
 * 6sense API Integration - LIVE
 * Company Identification API v3
 * Documentation: https://api.6sense.com/docs/#company-identification-api
 */

const SIXSENSE_API_KEY = process.env.SIXSENSE_API_KEY;
const SIXSENSE_API_URL = "https://epsilon.6sense.com/v3/company/details";

interface SixsenseCompanyData {
  company_match: string;
  company?: {
    companyId?: string;
    name?: string;
    domain?: string;
    industry?: string;
    employee_range?: string;
    employee_count?: number;
    revenue_range?: string;
    annual_revenue?: number;
    country?: string;
    state?: string;
    city?: string;
    region?: string;
  };
  buying_stage?: string;
  profile_fit?: string;
  intent_score?: number;
  segments?: string[];
}

/**
 * Fetch company identification data from 6sense by domain
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
    const response = await fetch(
      `${SIXSENSE_API_URL}?domain=${encodeURIComponent(domain)}`,
      {
        headers: {
          Authorization: `Token ${SIXSENSE_API_KEY}`,
        },
      }
    );

    if (response.status === 404) {
      console.log(`[6sense] No match found for domain ${domain}`);
      return null;
    }

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
 * Fetch company identification data by IP address
 */
export async function getCompanyByIP(ipAddress: string): Promise<SixsenseCompanyData | null> {
  if (!SIXSENSE_API_KEY) {
    console.warn("[6sense] API key not configured");
    return null;
  }

  if (!ipAddress) {
    console.warn("[6sense] IP address is required");
    return null;
  }

  try {
    const response = await fetch(
      `${SIXSENSE_API_URL}?ip=${encodeURIComponent(ipAddress)}`,
      {
        headers: {
          Authorization: `Token ${SIXSENSE_API_KEY}`,
        },
      }
    );

    if (response.status === 404) {
      console.log(`[6sense] No match found for IP ${ipAddress}`);
      return null;
    }

    if (!response.ok) {
      console.error(`[6sense] API error for IP ${ipAddress}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[6sense] Failed to fetch company data for ${ipAddress}:`, error);
    return null;
  }
}

/**
 * Get enriched company data for an account with intent scores
 */
export async function enrichAccount(domain: string) {
  const companyData = await getCompanyByDomain(domain);
  
  if (!companyData || !companyData.company) {
    return null;
  }

  const company = companyData.company;

  return {
    companyName: company.name,
    domain: company.domain,
    industry: company.industry,
    employeeCount: company.employee_count,
    employeeRange: company.employee_range,
    annualRevenue: company.annual_revenue,
    revenueRange: company.revenue_range,
    country: company.country,
    state: company.state,
    city: company.city,
    region: company.region,
    // Intent and scoring data
    intentScore: companyData.intent_score,
    buyingStage: companyData.buying_stage,
    profileFit: companyData.profile_fit,
    segments: companyData.segments || [],
    // Metadata
    sixsenseId: company.companyId,
    companyMatch: companyData.company_match,
  };
}
