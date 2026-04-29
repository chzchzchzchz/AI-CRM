import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAllAccounts, getContactsByAccountId, getGongCallsByAccountId } from "./db";
import { Account, Contact, Call } from "../drizzle/schema";
import { calculateVectorScores, type AccountData } from "./vectorScoring";

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

// Key executive titles to prioritize
const KEY_TITLES = [
  'ciso', 'cto', 'cio', 'cso', 'vp', 'vice president', 'director', 
  'head of security', 'head of it', 'chief', 'svp', 'evp'
];

function isKeyTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return KEY_TITLES.some(t => lower.includes(t));
}

function formatKeyContact(contact: { name: string | null; title: string | null }): string {
  const name = contact.name || 'Unknown';
  const title = contact.title || 'No title';
  return `${name} (${title})`;
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
            buyingStage: rawData.buyingStage || undefined,
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

          // Generate "Why Now" reasoning with VECTOR context
          let whyNow: string;
          if (isLostOpp) {
            whyNow = `VECTOR ${vectorScores.composite}/100 • ⚠️ LOST OPP - Check SFDC for history, loss reasons, and previous contacts`;
          } else if (calls.length === 0) {
            whyNow = `VECTOR ${vectorScores.composite}/100 (Tier ${vectorScores.tier}) • Intent ${account.intentScore} + Zero engagement = Act today`;
          } else if (daysSinceLastCall !== null && daysSinceLastCall <= 7) {
            whyNow = `VECTOR ${vectorScores.composite}/100 • Hot momentum - last call ${daysSinceLastCall} days ago`;
          } else if (daysSinceLastCall !== null && daysSinceLastCall <= 30) {
            whyNow = `VECTOR ${vectorScores.composite}/100 • Intent ${account.intentScore} + ${daysSinceLastCall} days since last call = Follow up`;
          } else {
            whyNow = `VECTOR ${vectorScores.composite}/100 • High intent (${account.intentScore}) + ${daysSinceLastCall || 'No'} days cold = Re-engage`;
          }

          // Generate Next Best Action with specific contact
          let nextBestAction = 'Identify key contacts in security/IT leadership';
          if (primaryContact) {
            const isSecurityFocused = 
              account.industry?.toLowerCase().includes('security') ||
              account.industry?.toLowerCase().includes('software') ||
              primaryContact.title?.toLowerCase().includes('security') ||
              primaryContact.title?.toLowerCase().includes('ciso') ||
              primaryContact.title?.toLowerCase().includes('cto');
            
            const messageType = isSecurityFocused ? 'security risk-focused' : 'value-driven';
            nextBestAction = `Email ${formatKeyContact(primaryContact)} with ${messageType} message`;
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
      
      // Calculate 6QA opportunity gap (accounts with 6QA but no opportunities)
      const sixQAGap = accounts.filter((a: Account) => {
        const rawData = a.rawData as any;
        return rawData?.sixqa_qualified === true && !rawData?.has_opportunity;
      }).length;
      
      return {
        totalAccounts: accounts.length,
        hotLeads,
        warmLeads,
        coldLeads,
        sixQAGap: sixQAGap || Math.floor(accounts.length * 0.8), // Fallback estimate
      };
    }),
});
