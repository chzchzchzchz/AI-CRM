import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAllAccounts, getContactsByAccountId, getGongCallsByAccountId, getAllOpportunities } from "./db";
import { Account, Contact, Call } from "../drizzle/schema";
import { calculateVectorScores, type AccountData } from "./vectorScoring";
import { isDecisionMaker } from "@shared/taxonomy";

// Rep territory assignments
// Under 2000 employees: Zane (Central), Morgan (West), Miranda (East)
// Over 2000 employees: Jeff (Central), Dan (West), Kevin (East)
const REP_TERRITORIES: Record<string, { region: string; minEmployees: number; maxEmployees: number }> = {
  // Under 2000 employees
  "zane.torres@{COMPANY_EMAIL_DOMAIN}": { region: "Central", minEmployees: 0, maxEmployees: 2000 },
  "morgan.iler@{COMPANY_EMAIL_DOMAIN}": { region: "West", minEmployees: 0, maxEmployees: 2000 },
  "miranda.thomas@{COMPANY_EMAIL_DOMAIN}": { region: "East", minEmployees: 0, maxEmployees: 2000 },
  // Over 2000 employees
  "jeff.klein@{COMPANY_EMAIL_DOMAIN}": { region: "Central", minEmployees: 2000, maxEmployees: Infinity },
  "dan.hamilton@{COMPANY_EMAIL_DOMAIN}": { region: "West", minEmployees: 2000, maxEmployees: Infinity },
  "kevin.huelster@{COMPANY_EMAIL_DOMAIN}": { region: "East", minEmployees: 2000, maxEmployees: Infinity },
};

// "Key title" is the same question as "decision maker", so it uses the same answer.
// It used to be a local list of twelve fragments matched with .includes(), which
// meant this router and the Decision makers tiles could disagree about the same
// contact.
const isKeyTitle = isDecisionMaker;

function formatKeyContact(contact: { name: string | null; title: string | null }): string {
  const name = contact.name || 'Unknown';
  const title = contact.title || 'No title';
  return `${name} (${title})`;
}

/**
 * These columns arrive as a real array, a JSON string, or a comma-joined string
 * depending on which connector wrote them. Normalise all three, and drop anything
 * blank — an empty string rendered into a sentence reads as a missing word.
 */
function toList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
      } catch {
        /* fall through to delimiter split */
      }
    }
    return s.split(/[,;|]/).map(x => x.trim()).filter(Boolean);
  }
  return [];
}

export const priorityActionsRouter = router({
  getEnriched: protectedProcedure
    .input(z.object({ 
      limit: z.number().default(3),
      userEmail: z.string().optional() // Pass logged-in user's email for filtering
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 3;
      const userEmail = input?.userEmail;
      const isDemoUser = ctx.user?.email?.includes('demo') || false;
      let accounts = await getAllAccounts(isDemoUser);
      
      // Apply rep-specific filtering only for non-demo users
      if (!isDemoUser && userEmail && REP_TERRITORIES[userEmail]) {
        const territory = REP_TERRITORIES[userEmail];
        accounts = accounts.filter((a: Account) => {
          const empCount = a.employeeCount || 0;
          return a.region === territory.region && 
            empCount >= territory.minEmployees && 
            empCount < territory.maxEmployees;
        });
      }
      
      const hotAccounts = accounts
        .filter((a: Account) => (a.intentScore || 0) >= 70)
        .sort((a: Account, b: Account) => (b.intentScore || 0) - (a.intentScore || 0))
        .slice(0, limit);

      const enrichedActions = await Promise.all(
        hotAccounts.map(async (account: Account) => {
          const contacts = await getContactsByAccountId(account.id);
          const calls = await getGongCallsByAccountId(account.id);
          
          // Sort contacts: key titles first, then by name
          const sortedContacts = [...contacts].sort((a: Contact, b: Contact) => {
            const aIsKey = isKeyTitle(a.title);
            const bIsKey = isKeyTitle(b.title);
            if (aIsKey && !bIsKey) return -1;
            if (!aIsKey && bIsKey) return 1;
            return (a.name || '').localeCompare(b.name || '');
          });
          
          const topContacts = sortedContacts.slice(0, 5).map((c: Contact) => ({
            name: c.name,
            title: c.title,
            email: c.email,
            location: c.location,
            isKeyTitle: isKeyTitle(c.title),
          }));

          // Find the primary contact (first key title or first contact)
          const primaryContact = topContacts.find(c => c.isKeyTitle) || topContacts[0];
          
          // Calculate last call date and days since
          const lastCallDate = calls.length > 0 
            ? new Date(Math.max(...calls.map((c: Call) => new Date(c.callDate || 0).getTime())))
            : null;
          
          const daysSinceLastCall = lastCallDate 
            ? Math.floor((Date.now() - lastCallDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          // Calculate VECTOR scores
          // Extract rawData fields
          const rawData = account.rawData as Record<string, any> || {};
          const temperature = rawData.temperature || ((account.intentScore || 0) >= 70 ? 'Hot' : (account.intentScore || 0) >= 40 ? 'Warm' : 'Cold');
          const daysSinceLastEngagement = rawData.daysSinceLastEngagement || rawData.lastSalesActivityDays || null;
          const accountOwner = rawData.accountOwner || rawData.owner || null;
          const opportunityStatus = rawData.opportunityStatus || null;
          const salesActivities = rawData.salesActivities || rawData.engagementActivities || 0;
          const lastSalesActivity = rawData.lastSalesActivity || rawData.latestEngagementActivity || null;
          const recentSecurityIncidents = rawData['Recent Security Incidents'] || null;
          const ssoProvider = rawData['SSO Provider'] || null;

          const accountData: AccountData = {
            name: account.name,
            domain: account.domain || undefined,
            industry: account.industry || undefined,
            employeeCount: account.employeeCount || undefined,
            region: account.region || undefined,
            relationship: account.relationship || undefined,
            intentScore: account.intentScore || undefined,
            // Real 6sense stage lives in sixsenseBuyingStage; rawData.buyingStage is never
            // populated, so the conversion score's 30-point buying-stage band was always 0.
            buyingStage: (account as any).sixsenseBuyingStage || rawData.buyingStage || undefined,
            temperature,
            totalContacts: contacts.length,
            totalCalls: calls.length,
            lastCallDate: lastCallDate || undefined,
            techStack: account.techStack ? JSON.parse(account.techStack) : undefined,
            securityStack: account.securityStack ? JSON.parse(account.securityStack) : undefined,
          };
          
          const vectorScores = calculateVectorScores(accountData);

          // Check for Lost Opp status
          const isLostOpp = account.relationship?.toLowerCase().includes('lost') || 
                           (account.rawData as any)?.relationship?.toLowerCase().includes('lost');
          const lostOppContext = isLostOpp 
            ? '⚠️ LOST OPP - Check Salesforce for deal history before re-engaging' 
            : null;

          /**
           * "Why now" in plain English, not as arithmetic.
           *
           * This used to render the formula at the reader: "VECTOR 80/100 • Intent 100 +
           * 26 days since last call = Follow up". A rep does not need to see the sum;
           * they need the sentence the sum implies. The composite score is already shown
           * as its own badge beside this line, so repeating it here was noise too.
           */
          let whyNow: string;
          if (isLostOpp) {
            whyNow = `Previously lost — check Salesforce for why before re-engaging`;
          } else if (calls.length === 0) {
            whyNow = `Intent ${account.intentScore} and nobody has ever called them`;
          } else if (daysSinceLastCall !== null && daysSinceLastCall <= 7) {
            whyNow = `Live conversation — you spoke ${daysSinceLastCall === 0 ? 'today' : daysSinceLastCall === 1 ? 'yesterday' : `${daysSinceLastCall} days ago`}`;
          } else if (daysSinceLastCall !== null && daysSinceLastCall <= 30) {
            whyNow = `Intent hit ${account.intentScore} and nobody has called in ${daysSinceLastCall} days`;
          } else {
            whyNow = `Intent ${account.intentScore} but the account has gone quiet for ${daysSinceLastCall ?? 'over 30'} days`;
          }

          /**
           * The hook, not the category.
           *
           * This used to be a two-branch template: every account got either "with
           * security risk-focused message" or "with value-driven message" depending on
           * whether a title contained "ciso". Two sentences across a thousand accounts,
           * telling a rep nothing they could open an email with — while the README called
           * it AI-generated.
           *
           * The specifics were already loaded on this request and unused: recorded
           * trigger events, commitments made on the last call, what they run. No model,
           * no extra query, and every one of them is a real thing to say.
           */
          const triggers = toList(account.triggerEvents).slice(0, 2);
          const openCommitments = Array.from(
            new Set(calls.flatMap((c: any) => toList(c.actionItems)))
          ).slice(0, 1);
          const stack = [
            ...toList(account.securityStack).slice(0, 2),
            ...toList(account.techStack).slice(0, 1),
          ];

          let nextBestAction: string;
          if (!primaryContact) {
            nextBestAction = 'No contacts on file — find a stakeholder before anything else';
          } else {
            const who = formatKeyContact(primaryContact);
            // Ordered by how much a rep would want it: an unmet promise beats a news
            // event, which beats a guess from their tech stack.
            const hook = openCommitments.length
              ? `close out "${openCommitments[0]}" from the last call`
              : triggers.length
                ? `lead with ${triggers.join(' and ')}`
                : stack.length
                  ? `reference their ${stack.join('/')} setup`
                  : null;
            nextBestAction = hook ? `Email ${who} — ${hook}` : `Email ${who}`;
          }

          // Calculate engagement metrics
          const engagementMetrics = {
            totalCalls: calls.length,
            lastCallDate: lastCallDate ? lastCallDate.toISOString() : null,
            daysSinceLastCall,
            lastCallFormatted: lastCallDate 
              ? lastCallDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Never',
            // Response rate placeholder - would need email tracking data
            responseRate: null as number | null,
          };

          return {
            id: account.id,
            name: account.name,
            domain: account.domain,
            industry: account.industry,
            employeeCount: account.employeeCount,
            region: account.region,
            intentScore: account.intentScore,
            relationship: account.relationship,
            // VECTOR Scoring
            vectorScores: {
              composite: vectorScores.composite,
              tier: vectorScores.tier,
              engagement: vectorScores.engagement,
              conversion: vectorScores.conversion,
              strategic: vectorScores.strategic,
              timing: vectorScores.timing,
            },
            // Contact info
            contactCount: contacts.length,
            topContacts,
            primaryContact: primaryContact ? formatKeyContact(primaryContact) : null,
            keyContactsCount: topContacts.filter(c => c.isKeyTitle).length,
            // Engagement metrics
            engagementMetrics,
            // Actions
            whyNow,
            nextBestAction,
            // Lost Opp context
            isLostOpp,
            lostOppContext,
            // NEW: Surfaced rawData fields
            temperature,
            daysSinceLastEngagement,
            accountOwner,
            opportunityStatus,
            salesActivities,
            lastSalesActivity,
            recentSecurityIncidents,
            ssoProvider,
            // Trigger events from main schema
            triggerEvents: account.triggerEvents || null,
          };
        })
      );

      return enrichedActions;
    }),

  // Get rep territory info
  getRepTerritory: protectedProcedure
    .input(z.object({ userEmail: z.string() }))
    .query(async ({ ctx, input }) => {
      const territory = REP_TERRITORIES[input.userEmail];
      if (!territory) {
        return null;
      }
      
      const isDemoUser = ctx.user?.email?.includes('demo') || false;
      const accounts = await getAllAccounts(isDemoUser);
      const repAccounts = accounts.filter((a: Account) => {
        const empCount = a.employeeCount || 0;
        return a.region === territory.region && 
          empCount >= territory.minEmployees && 
          empCount < territory.maxEmployees;
      });
      
      const hotLeads = repAccounts.filter((a: Account) => (a.intentScore || 0) >= 70).length;
      const warmLeads = repAccounts.filter((a: Account) => {
        const score = a.intentScore || 0;
        return score >= 40 && score < 70;
      }).length;
      
      return {
        region: territory.region,
        maxEmployees: territory.maxEmployees,
        totalAccounts: repAccounts.length,
        hotLeads,
        warmLeads,
      };
    }),

  // Get dashboard stats filtered by rep
  getRepStats: protectedProcedure
    .input(z.object({ userEmail: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const isDemoUser = ctx.user?.email?.includes('demo') || false;
      let accounts = await getAllAccounts(isDemoUser);
      
      // Apply rep-specific filtering if user email matches a known rep
      if (input?.userEmail && REP_TERRITORIES[input.userEmail]) {
        const territory = REP_TERRITORIES[input.userEmail];
        accounts = accounts.filter((a: Account) => {
          const empCount = a.employeeCount || 0;
          return a.region === territory.region && 
            empCount >= territory.minEmployees && 
            empCount < territory.maxEmployees;
        });
      }
      
      const hotLeads = accounts.filter((a: Account) => (a.intentScore || 0) >= 70).length;
      const warmLeads = accounts.filter((a: Account) => {
        const score = a.intentScore || 0;
        return score >= 40 && score < 70;
      }).length;
      const coldLeads = accounts.filter((a: Account) => (a.intentScore || 0) < 40).length;
      
      // 6QA opportunity gap: qualified accounts (intent >= 70) with no opportunity yet.
      // Previously this read rawData.sixqa_qualified / has_opportunity, which nothing
      // populates, so it was always 0 and fell back to a fabricated 80% of all accounts.
      const allOpps = await getAllOpportunities().catch(() => []);
      const accountsWithOpp = new Set(
        (allOpps as any[]).map((o) => o.accountId).filter((id) => id != null)
      );
      const sixQAGap = accounts.filter(
        (a: Account) => (a.intentScore || 0) >= 70 && !accountsWithOpp.has(a.id)
      ).length;

      return {
        totalAccounts: accounts.length,
        hotLeads,
        warmLeads,
        coldLeads,
        sixQAGap,
      };
    }),
});
