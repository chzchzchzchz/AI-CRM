/**
 * Hot Leads Router
 * Provides the top contacts at high-intent accounts for immediate outreach
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { accounts, contacts } from "../drizzle/schema";
import { desc, eq, gte, isNotNull, sql } from "drizzle-orm";

export interface HotLead {
  contactId: number;
  contactName: string;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  accountId: number;
  accountName: string;
  accountDomain: string | null;
  intentScore: number;
  buyingStage: string | null;
  profileFit: string | null;
  industry: string | null;
  employeeCount: number | null;
  region: string | null;
  priorityScore: number; // Composite score for ranking
  priorityReason: string;
}

/**
 * Calculate priority score for a contact at an account
 * Higher score = higher priority for outreach
 */
function calculatePriorityScore(
  intentScore: number,
  buyingStage: string | null,
  profileFit: string | null,
  title: string | null,
  hasLinkedIn: boolean,
  hasEmail: boolean
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Intent score contribution (0-40 points)
  score += Math.min(intentScore * 0.4, 40);
  if (intentScore >= 90) {
    reasons.push("Very high intent");
  } else if (intentScore >= 80) {
    reasons.push("High intent");
  }

  // Buying stage contribution (0-25 points)
  const buyingStageScores: Record<string, number> = {
    'Purchase': 25,
    'Decision': 20,
    'Consideration': 15,
    'Evaluation': 10,
    'Awareness': 5,
  };
  const stageScore = buyingStageScores[buyingStage || ''] || 0;
  score += stageScore;
  if (stageScore >= 20) {
    reasons.push(`${buyingStage} stage`);
  }

  // Profile fit contribution (0-15 points)
  const fitScores: Record<string, number> = {
    'Strong': 15,
    'Moderate': 10,
    'Weak': 5,
  };
  score += fitScores[profileFit || ''] || 0;

  // Title-based scoring (0-15 points) - prioritize decision makers
  const titleLower = (title || '').toLowerCase();
  if (titleLower.includes('ciso') || titleLower.includes('chief information security')) {
    score += 15;
    reasons.push("CISO");
  } else if (titleLower.includes('vp') || titleLower.includes('vice president')) {
    score += 12;
    reasons.push("VP-level");
  } else if (titleLower.includes('director')) {
    score += 10;
    reasons.push("Director-level");
  } else if (titleLower.includes('head of') || titleLower.includes('lead')) {
    score += 8;
  } else if (titleLower.includes('manager')) {
    score += 5;
  }

  // Security/IAM title bonus
  if (titleLower.includes('security') || titleLower.includes('iam') || 
      titleLower.includes('identity') || titleLower.includes('access')) {
    score += 5;
    if (!reasons.some(r => r.includes('CISO'))) {
      reasons.push("Security focus");
    }
  }

  // Contact info availability (0-5 points)
  if (hasLinkedIn) score += 3;
  if (hasEmail) score += 2;

  return {
    score: Math.round(score),
    reason: reasons.length > 0 ? reasons.join(" • ") : "Potential lead"
  };
}

export const hotLeadsRouter = router({
  /**
   * Get top hot leads - contacts at high-intent accounts
   */
  getTopLeads: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      minIntentScore: z.number().min(0).max(100).default(70),
      region: z.string().optional(),
      industry: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const { limit, minIntentScore, region, industry } = input;

      // Query accounts with high intent scores that have contacts
      let query = db
        .select({
          contactId: contacts.id,
          contactName: contacts.name,
          contactTitle: contacts.title,
          contactEmail: contacts.email,
          contactPhone: contacts.phone,
          linkedinUrl: contacts.linkedinUrl,
          accountId: accounts.id,
          accountName: accounts.name,
          accountDomain: accounts.domain,
          intentScore: accounts.intentScore,
          buyingStage: accounts.sixsenseBuyingStage,
          profileFit: accounts.sixsenseProfileFit,
          industry: accounts.industry,
          employeeCount: accounts.employeeCount,
          region: accounts.region,
        })
        .from(contacts)
        .innerJoin(accounts, eq(contacts.accountId, accounts.id))
        .where(gte(accounts.intentScore, minIntentScore))
        .orderBy(desc(accounts.intentScore))
        .limit(limit * 3); // Get more to filter and rank

      const results = await query;

      // Calculate priority scores and rank
      const hotLeads: HotLead[] = results.map((row: any) => {
        const { score, reason } = calculatePriorityScore(
          row.intentScore || 0,
          row.buyingStage,
          row.profileFit,
          row.contactTitle,
          !!row.linkedinUrl,
          !!row.contactEmail
        );

        return {
          contactId: row.contactId,
          contactName: row.contactName,
          contactTitle: row.contactTitle,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          linkedinUrl: row.linkedinUrl,
          accountId: row.accountId,
          accountName: row.accountName,
          accountDomain: row.accountDomain,
          intentScore: row.intentScore || 0,
          buyingStage: row.buyingStage,
          profileFit: row.profileFit,
          industry: row.industry,
          employeeCount: row.employeeCount,
          region: row.region,
          priorityScore: score,
          priorityReason: reason,
        };
      });

      // Filter by region/industry if specified
      let filtered = hotLeads;
      if (region) {
        filtered = filtered.filter(l => l.region?.toLowerCase().includes(region.toLowerCase()));
      }
      if (industry) {
        filtered = filtered.filter(l => l.industry?.toLowerCase().includes(industry.toLowerCase()));
      }

      // Sort by priority score and return top N
      return filtered
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, limit);
    }),

  /**
   * Get summary stats for hot leads
   */
  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    // Get counts by intent tier
    const results = await db
      .select({
        intentTier: sql<string>`
          CASE 
            WHEN ${accounts.intentScore} >= 90 THEN 'critical'
            WHEN ${accounts.intentScore} >= 80 THEN 'high'
            WHEN ${accounts.intentScore} >= 70 THEN 'medium'
            ELSE 'low'
          END
        `,
        accountCount: sql<number>`COUNT(DISTINCT ${accounts.id})`,
        contactCount: sql<number>`COUNT(${contacts.id})`,
      })
      .from(accounts)
      .leftJoin(contacts, eq(contacts.accountId, accounts.id))
      .where(gte(accounts.intentScore, 70))
      .groupBy(sql`intentTier`);

    const summary = {
      critical: { accounts: 0, contacts: 0 },
      high: { accounts: 0, contacts: 0 },
      medium: { accounts: 0, contacts: 0 },
      total: { accounts: 0, contacts: 0 },
    };

    for (const row of results) {
      const tier = row.intentTier as keyof typeof summary;
      if (tier in summary) {
        summary[tier].accounts = Number(row.accountCount);
        summary[tier].contacts = Number(row.contactCount);
        summary.total.accounts += Number(row.accountCount);
        summary.total.contacts += Number(row.contactCount);
      }
    }

    return summary;
  }),

  /**
   * Get hot leads by buying stage
   */
  getByBuyingStage: protectedProcedure
    .input(z.object({
      stage: z.enum(['Purchase', 'Decision', 'Consideration', 'Evaluation', 'Awareness']),
      limit: z.number().min(1).max(20).default(5),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const { stage, limit } = input;

      const results = await db
        .select({
          contactId: contacts.id,
          contactName: contacts.name,
          contactTitle: contacts.title,
          contactEmail: contacts.email,
          linkedinUrl: contacts.linkedinUrl,
          accountId: accounts.id,
          accountName: accounts.name,
          intentScore: accounts.intentScore,
          buyingStage: accounts.sixsenseBuyingStage,
        })
        .from(contacts)
        .innerJoin(accounts, eq(contacts.accountId, accounts.id))
        .where(eq(accounts.sixsenseBuyingStage, stage))
        .orderBy(desc(accounts.intentScore))
        .limit(limit);

      return results;
    }),
});
