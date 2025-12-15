import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { eq, isNull, and, desc, sql } from "drizzle-orm";
import { accounts, contacts } from "../drizzle/schema";
import { getDb } from "./db";

// Scraping configuration with anti-detection settings
const SCRAPER_CONFIG = {
  // Rate limits (conservative to avoid detection)
  maxContactsPerDay: 50,
  maxCompaniesPerDay: 10,
  
  // Delays (in milliseconds) - randomized for human-like behavior
  minDelayBetweenProfiles: 5000,  // 5 seconds
  maxDelayBetweenProfiles: 10000, // 10 seconds
  minDelayBetweenCompanies: 30000, // 30 seconds
  maxDelayBetweenCompanies: 60000, // 60 seconds
  
  // Session limits
  maxProfilesPerSession: 30,
  breakDurationMs: 15 * 60 * 1000, // 15 minute break
  
  // Business hours only (to appear more human)
  businessHoursStart: 9,
  businessHoursEnd: 18,
  
  // Title keywords to filter contacts
  targetTitles: [
    'ciso', 'cio', 'cto', 'ceo', 'cfo',
    'vp', 'vice president',
    'director', 'head of',
    'manager', 'lead',
    'security', 'identity', 'iam', 'access',
    'it', 'information technology',
    'engineering', 'architect'
  ]
};

// Helper to generate human-like random delay
function humanDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Check if current time is within business hours
function isBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= SCRAPER_CONFIG.businessHoursStart && 
         hour < SCRAPER_CONFIG.businessHoursEnd;
}

export const linkedinScraperRouter = router({
  // Get scraping status and queue
  getStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Get accounts that need scraping (have LinkedIn URL but few contacts)
    const accountsNeedingScrape = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        domain: accounts.domain,
        linkedinCompanyUrl: accounts.linkedinCompanyUrl,
        intentScore: accounts.intentScore,
        contactCount: sql<number>`(SELECT COUNT(*) FROM contacts WHERE accountId = accounts.id)`
      })
      .from(accounts)
      .where(
        and(
          sql`${accounts.linkedinCompanyUrl} IS NOT NULL`,
          sql`(SELECT COUNT(*) FROM contacts WHERE accountId = accounts.id) < 5`
        )
      )
      .orderBy(desc(accounts.intentScore))
      .limit(50);
    
    return {
      config: SCRAPER_CONFIG,
      isBusinessHours: isBusinessHours(),
      queuedAccounts: accountsNeedingScrape,
      totalInQueue: accountsNeedingScrape.length
    };
  }),

  // Get accounts ready for scraping (prioritized by intent score)
  getScrapingQueue: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(10)
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const queue = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          domain: accounts.domain,
          linkedinCompanyUrl: accounts.linkedinCompanyUrl,
          linkedinCompanyId: accounts.linkedinCompanyId,
          intentScore: accounts.intentScore,
          industry: accounts.industry,
          employeeCount: accounts.employeeCount
        })
        .from(accounts)
        .where(
          and(
            sql`${accounts.linkedinCompanyUrl} IS NOT NULL`,
            sql`(SELECT COUNT(*) FROM contacts WHERE accountId = accounts.id) < 3`
          )
        )
        .orderBy(desc(accounts.intentScore))
        .limit(input.limit);
      
      return queue;
    }),

  // Generate MCP Playwright commands for scraping a company
  generateScrapeCommands: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      linkedinUrl: z.string()
    }))
    .mutation(async ({ input }) => {
      // Generate the MCP commands that will be executed via manus-mcp-cli
      const peopleUrl = input.linkedinUrl.replace(/\/$/, '') + '/people/';
      
      const commands = [
        {
          step: 1,
          description: "Navigate to company people page",
          command: `manus-mcp-cli tool call browser_navigate --server playwright --input '{"url": "${peopleUrl}"}'`,
          delay: humanDelay(3000, 5000)
        },
        {
          step: 2,
          description: "Wait for page to load",
          command: `manus-mcp-cli tool call browser_snapshot --server playwright --input '{}'`,
          delay: humanDelay(2000, 4000)
        },
        {
          step: 3,
          description: "Scroll to load more results",
          command: `manus-mcp-cli tool call browser_scroll --server playwright --input '{"direction": "down", "amount": 500}'`,
          delay: humanDelay(2000, 3000)
        },
        {
          step: 4,
          description: "Take snapshot of employee list",
          command: `manus-mcp-cli tool call browser_snapshot --server playwright --input '{}'`,
          delay: humanDelay(1000, 2000)
        }
      ];
      
      return {
        accountId: input.accountId,
        linkedinUrl: input.linkedinUrl,
        peopleUrl,
        commands,
        antiDetectionTips: [
          "Ensure you're logged into LinkedIn in the browser first",
          "Don't run more than 10 companies per day",
          "Take 15-minute breaks every 30 profiles",
          "Only scrape during business hours (9am-6pm)",
          "If you see a CAPTCHA, stop immediately and wait 24 hours"
        ]
      };
    }),

  // Save scraped contacts to database
  saveScrapedContacts: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      contacts: z.array(z.object({
        name: z.string(),
        title: z.string().optional(),
        linkedinUrl: z.string().optional(),
        location: z.string().optional()
      }))
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get account info
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);
      
      if (!account) throw new Error("Account not found");
      
      let imported = 0;
      let skipped = 0;
      
      for (const contact of input.contacts) {
        // Check if contact already exists (by name + account)
        const existing = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.accountId, input.accountId),
              eq(contacts.name, contact.name)
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        
        // Filter by target titles
        const titleLower = (contact.title || '').toLowerCase();
        const isTargetTitle = SCRAPER_CONFIG.targetTitles.some(t => 
          titleLower.includes(t)
        );
        
        if (!isTargetTitle && contact.title) {
          skipped++;
          continue;
        }
        
        // Insert new contact
        await db.insert(contacts).values({
          accountId: input.accountId,
          name: contact.name,
          title: contact.title || null,
          linkedinUrl: contact.linkedinUrl || null,
          location: contact.location || null
        });
        
        imported++;
      }
      
      return {
        imported,
        skipped,
        total: input.contacts.length
      };
    }),

  // Get LinkedIn scraping instructions for manual execution
  getInstructions: protectedProcedure.query(async () => {
    return {
      title: "LinkedIn Contact Scraping Guide",
      steps: [
        {
          step: 1,
          title: "Login to LinkedIn",
          description: "Open LinkedIn in your browser and ensure you're logged in with a Sales Navigator account for best results."
        },
        {
          step: 2,
          title: "Navigate to Company",
          description: "Go to the target company's LinkedIn page and click on 'People' to see employees."
        },
        {
          step: 3,
          title: "Filter by Title",
          description: "Use LinkedIn's filters to narrow down to relevant titles: VP, Director, CISO, Security, IT, etc."
        },
        {
          step: 4,
          title: "Export with Evaboot/Phantombuster",
          description: "Use a Chrome extension like Evaboot or Phantombuster to export the filtered list to CSV."
        },
        {
          step: 5,
          title: "Import to Dashboard",
          description: "Upload the CSV to the dashboard's import feature to add contacts to the account."
        }
      ],
      safetyLimits: SCRAPER_CONFIG,
      warningMessage: "LinkedIn actively detects and bans automated scraping. Always use human-like patterns and respect rate limits."
    };
  })
});
