import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { rfps } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

/**
 * SAM.gov Opportunities API Integration
 * 
 * API Documentation: https://open.gsa.gov/api/opportunities-api/
 * 
 * Endpoints:
 * - Production: https://api.sam.gov/prod/opportunity/v2/search
 * - Alpha: https://api-alpha.sam.gov/prodlike/opportunity/v2/search
 * 
 * Authentication:
 * - Requires SAM.gov System Account API Key
 * - Pass as query parameter: api_key=YOUR_KEY
 * 
 * Search Parameters:
 * - keyword: Search term (e.g., "MFA", "SSO", "multi-factor authentication")
 * - postedFrom/postedTo: Date range (YYYY-MM-DD)
 * - noticeType: Filter by notice type (o=Solicitation, k=Combined Synopsis, etc.)
 * - active: true/false for active opportunities only
 */

const SAM_GOV_API_BASE = "https://api.sam.gov/prod/opportunity/v2";

// Keywords to search for MFA/SSO/Zero Trust opportunities
const MFA_SSO_KEYWORDS = [
  "multi-factor authentication",
  "MFA",
  "two-factor authentication",
  "2FA",
  "single sign-on",
  "SSO",
  "identity access management",
  "IAM",
  "zero trust",
  "passwordless",
  "authentication",
  "identity management",
  "access control"
];

interface SAMOpportunity {
  noticeId: string;
  title: string;
  solicitationNumber: string;
  department: string;
  subTier: string;
  office: string;
  postedDate: string;
  type: string;
  baseType: string;
  archiveType: string;
  archiveDate: string | null;
  typeOfSetAsideDescription: string | null;
  typeOfSetAside: string | null;
  responseDeadLine: string | null;
  naicsCode: string | null;
  classificationCode: string | null;
  active: string;
  award: any;
  pointOfContact: Array<{
    fax: string | null;
    type: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    fullName: string;
  }>;
  description: string;
  organizationType: string;
  officeAddress: {
    zipcode: string;
    city: string;
    countryCode: string;
    state: string;
  };
  placeOfPerformance: {
    streetAddress: string | null;
    city: {
      code: string;
      name: string;
    };
    state: {
      code: string;
      name: string;
    };
    zip: string | null;
    country: {
      code: string;
      name: string;
    };
  };
  additionalInfoLink: string | null;
  uiLink: string;
  links: Array<{
    rel: string;
    href: string;
  }>;
  resourceLinks: string[];
}

interface SAMSearchResponse {
  totalRecords: number;
  limit: number;
  offset: number;
  opportunitiesData: SAMOpportunity[];
}

/**
 * Search SAM.gov for opportunities matching keywords
 */
async function searchSAMGov(apiKey: string, keyword: string, limit: number = 100): Promise<SAMOpportunity[]> {
  const url = new URL(`${SAM_GOV_API_BASE}/search`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", "0");
  url.searchParams.set("active", "true"); // Only active opportunities
  
  // Date range: last 90 days
  const today = new Date();
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);
  url.searchParams.set("postedFrom", ninetyDaysAgo.toISOString().split('T')[0]);
  url.searchParams.set("postedTo", today.toISOString().split('T')[0]);

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`SAM.gov API error: ${response.status} ${response.statusText}`);
  }

  const data: SAMSearchResponse = await response.json();
  return data.opportunitiesData || [];
}

/**
 * Scrape all MFA/SSO related RFPs from SAM.gov
 */
async function scrapeAllRFPs(apiKey: string): Promise<SAMOpportunity[]> {
  const allOpportunities: SAMOpportunity[] = [];
  const seenIds = new Set<string>();

  for (const keyword of MFA_SSO_KEYWORDS) {
    try {
      console.log(`[RFP Scraper] Searching for: ${keyword}`);
      const opportunities = await searchSAMGov(apiKey, keyword, 100);
      
      // Deduplicate by noticeId
      for (const opp of opportunities) {
        if (!seenIds.has(opp.noticeId)) {
          seenIds.add(opp.noticeId);
          allOpportunities.push(opp);
        }
      }
      
      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[RFP Scraper] Error searching for "${keyword}":`, error);
    }
  }

  console.log(`[RFP Scraper] Found ${allOpportunities.length} unique opportunities`);
  return allOpportunities;
}

/**
 * Store scraped RFPs in database
 */
async function storeRFPs(opportunities: SAMOpportunity[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let inserted = 0;

  for (const opp of opportunities) {
    try {
      // Check if already exists
      const existing = await db.select().from(rfps).where(eq(rfps.url, opp.uiLink)).limit(1);
      
      if (existing.length === 0) {
        await db.insert(rfps).values({
          title: opp.title,
          agency: `${opp.department} - ${opp.subTier}`,
          responseDeadline: opp.responseDeadLine ? new Date(opp.responseDeadLine) : null,
          awardAmount: null,
          description: opp.description,
          url: opp.uiLink,
          solicitationNumber: opp.solicitationNumber,
          postedDate: opp.postedDate ? new Date(opp.postedDate) : null,
          samGovId: opp.noticeId,
          status: opp.active === 'Yes' ? 'open' : 'closed',
        });
        inserted++;
      }
    } catch (error) {
      console.error(`[RFP Scraper] Error storing RFP ${opp.noticeId}:`, error);
    }
  }

  console.log(`[RFP Scraper] Inserted ${inserted} new RFPs`);
  return inserted;
}

export const rfpRouter = router({
  /**
   * Get all RFPs from database
   */
  list: publicProcedure
    .input(z.object({
      status: z.enum(["open", "closed", "awarded"]).optional(),
      type: z.enum(["government", "private"]).optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let query = db.select().from(rfps);

      if (input?.status) {
        query = query.where(eq(rfps.status, input.status)) as any;
      }

      const results = await query.orderBy(desc(rfps.createdAt)).limit(input?.limit || 100);

      return results;
    }),

  /**
   * Manually trigger RFP scraping (requires SAM.gov API key)
   */
  scrape: publicProcedure
    .input(z.object({
      apiKey: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const opportunities = await scrapeAllRFPs(input.apiKey);
        const inserted = await storeRFPs(opportunities);

        return {
          success: true,
          total: opportunities.length,
          inserted,
          message: `Scraped ${opportunities.length} opportunities, inserted ${inserted} new RFPs`
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  /**
   * Get RFP statistics
   */
  stats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, open: 0, closed: 0, awarded: 0 };

    const allRfps = await db.select().from(rfps);

    return {
      total: allRfps.length,
      open: allRfps.filter(r => r.status === "open").length,
      closed: allRfps.filter(r => r.status === "closed").length,
      awarded: allRfps.filter(r => r.status === "awarded").length,
      government: 0, // type column doesn't exist in schema
      private: 0, // type column doesn't exist in schema
    };
  }),
});
