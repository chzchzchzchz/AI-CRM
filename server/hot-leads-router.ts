/**
 * Hot Leads Router
 * Provides the top contacts at high-intent accounts for immediate outreach
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAllAccounts, getAllPeople } from "./db";
import { inferSeniority } from "@shared/taxonomy";

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

  // Title-based scoring (0-15 points) - prioritize decision makers.
  //
  // The tier comes from @shared/taxonomy so this router agrees with the Decision
  // makers tiles about who is senior; only the weights are local, because how much
  // seniority is worth against intent is a scoring decision, not a definition.
  const titleLower = (title || '').toLowerCase();
  const TITLE_POINTS: Record<string, number> = {
    "C-Suite": 15, VP: 12, Director: 10, Manager: 5, Individual: 0, Unknown: 0,
  };
  const seniority = inferSeniority(title);
  score += TITLE_POINTS[seniority];
  if (seniority === "C-Suite") {
    // Name the office when it's the one that buys this; "C-Suite" alone tells a rep less.
    reasons.push(/\bciso\b|chief information security/i.test(titleLower) ? "CISO" : "C-level");
  } else if (seniority === "VP") {
    reasons.push("VP-level");
  } else if (seniority === "Director") {
    reasons.push("Director-level");
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
      const { limit, minIntentScore, region, industry } = input;

      // Fetch via demo-safe helpers and join in JS so this works with both the
      // real DB and the JSON demo database (which can't execute innerJoin/groupBy).
      const [accts, people] = await Promise.all([getAllAccounts(), getAllPeople()]);
      const acctById = new Map<number, any>(accts.map((a: any) => [a.id, a]));

      const hotLeads: HotLead[] = [];
      for (const p of people as any[]) {
        const acct = acctById.get(p.accountId);
        if (!acct) continue;
        const intentScore = acct.intentScore ?? p.accountIntentScore ?? 0;
        if (intentScore < minIntentScore) continue;

        const { score, reason } = calculatePriorityScore(
          intentScore,
          acct.sixsenseBuyingStage,
          acct.sixsenseProfileFit,
          p.title,
          !!p.linkedinUrl,
          !!p.email
        );

        hotLeads.push({
          contactId: p.id,
          contactName: p.name,
          contactTitle: p.title,
          contactEmail: p.email,
          contactPhone: p.phone,
          linkedinUrl: p.linkedinUrl,
          accountId: acct.id,
          accountName: acct.name,
          accountDomain: acct.domain,
          intentScore,
          buyingStage: acct.sixsenseBuyingStage,
          profileFit: acct.sixsenseProfileFit,
          industry: acct.industry,
          employeeCount: acct.employeeCount,
          region: acct.region,
          priorityScore: score,
          priorityReason: reason,
        });
      }

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
    // Fetch via demo-safe helpers and aggregate in JS (the JSON demo DB can't
    // execute SQL groupBy/COUNT).
    const [accts, people] = await Promise.all([getAllAccounts(), getAllPeople()]);

    // Contacts per account id
    const contactsByAccount = new Map<number, number>();
    for (const p of people as any[]) {
      contactsByAccount.set(p.accountId, (contactsByAccount.get(p.accountId) || 0) + 1);
    }

    const summary = {
      critical: { accounts: 0, contacts: 0 },
      high: { accounts: 0, contacts: 0 },
      medium: { accounts: 0, contacts: 0 },
      total: { accounts: 0, contacts: 0 },
    };

    for (const a of accts as any[]) {
      const intent = a.intentScore ?? 0;
      if (intent < 70) continue;
      const tier: keyof typeof summary =
        intent >= 90 ? "critical" : intent >= 80 ? "high" : "medium";
      const contactCount = contactsByAccount.get(a.id) || 0;
      summary[tier].accounts += 1;
      summary[tier].contacts += contactCount;
      summary.total.accounts += 1;
      summary.total.contacts += contactCount;
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
      const { stage, limit } = input;

      const [accts, people] = await Promise.all([getAllAccounts(), getAllPeople()]);
      const acctById = new Map<number, any>(accts.map((a: any) => [a.id, a]));

      // Same HotLead shape as getTopLeads, and ranked the same way.
      //
      // This used to return a narrower object — no phone, no priority score, no reason —
      // so a caller could not render the two lists with one component. Two shapes for one
      // concept is how a UI ends up with two code paths that drift apart.
      const results: HotLead[] = [];
      for (const p of people as any[]) {
        const acct = acctById.get(p.accountId);
        if (!acct || acct.sixsenseBuyingStage !== stage) continue;

        const intentScore = acct.intentScore ?? 0;
        const { score, reason } = calculatePriorityScore(
          intentScore,
          acct.sixsenseBuyingStage,
          acct.sixsenseProfileFit,
          p.title,
          !!p.linkedinUrl,
          !!p.email
        );

        results.push({
          contactId: p.id,
          contactName: p.name,
          contactTitle: p.title,
          contactEmail: p.email,
          contactPhone: p.phone,
          linkedinUrl: p.linkedinUrl,
          accountId: acct.id,
          accountName: acct.name,
          accountDomain: acct.domain,
          intentScore,
          buyingStage: acct.sixsenseBuyingStage,
          profileFit: acct.sixsenseProfileFit,
          industry: acct.industry,
          employeeCount: acct.employeeCount,
          region: acct.region,
          priorityScore: score,
          priorityReason: reason,
        });
      }

      return results.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, limit);
    }),
});
