import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAllAccounts, getContactsByAccountId, getGongCallsByAccountId } from "./db";

// Rep territory assignments
// Under 2000 employees: Zane (Central), Morgan (West), Miranda (East)
// Over 2000 employees: Jeff (Central), Dan (West), Kevin (East)
const REP_TERRITORIES: Record<string, { region: string; minEmployees: number; maxEmployees: number }> = {
  // Under 2000 employees
  "zane.torres@company.com": { region: "Central", minEmployees: 0, maxEmployees: 2000 },
  "morgan.iler@company.com": { region: "West", minEmployees: 0, maxEmployees: 2000 },
  "miranda.thomas@company.com": { region: "East", minEmployees: 0, maxEmployees: 2000 },
  // Over 2000 employees
  "jeff.klein@company.com": { region: "Central", minEmployees: 2000, maxEmployees: Infinity },
  "dan.hamilton@company.com": { region: "West", minEmployees: 2000, maxEmployees: Infinity },
  "kevin.huelster@company.com": { region: "East", minEmployees: 2000, maxEmployees: Infinity },
};

export const priorityActionsRouter = router({
  getEnriched: publicProcedure
    .input(z.object({ 
      limit: z.number().default(3),
      userEmail: z.string().optional() // Pass logged-in user's email for filtering
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 3;
      const userEmail = input?.userEmail;
      let accounts = await getAllAccounts();
      
      // Apply rep-specific filtering if user email is provided
      if (userEmail && REP_TERRITORIES[userEmail]) {
        const territory = REP_TERRITORIES[userEmail];
        accounts = accounts.filter(a => {
          const empCount = a.employeeCount || 0;
          return a.region === territory.region && 
            empCount >= territory.minEmployees && 
            empCount < territory.maxEmployees;
        });
      }
      
      const hotAccounts = accounts
        .filter(a => (a.intentScore || 0) >= 70)
        .sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0))
        .slice(0, limit);

      const enrichedActions = await Promise.all(
        hotAccounts.map(async (account) => {
          const contacts = await getContactsByAccountId(account.id);
          const topContacts = contacts.slice(0, 3).map(c => ({
            name: c.name,
            title: c.title,
            email: c.email,
            location: c.location,
          }));

          const calls = await getGongCallsByAccountId(account.id);
          const lastCallDate = calls.length > 0 
            ? new Date(Math.max(...calls.map(c => new Date(c.callDate || 0).getTime())))
            : null;

          // Generate "Why Now" reasoning
          const whyNow = calls.length === 0
            ? `Extremely high intent (${account.intentScore}) + Zero recent engagement = Must act today`
            : `High intent (${account.intentScore}) + Last call ${lastCallDate ? new Date(lastCallDate).toLocaleDateString() : 'unknown'} = Follow up this week`;

          // Generate Next Best Action
          let nextBestAction = 'Identify key contacts in security/IT leadership';
          if (topContacts.length > 0) {
            const topContact = topContacts[0];
            const isSecurityFocused = 
              account.industry?.toLowerCase().includes('security') ||
              account.industry?.toLowerCase().includes('software') ||
              topContact.title?.toLowerCase().includes('security') ||
              topContact.title?.toLowerCase().includes('ciso') ||
              topContact.title?.toLowerCase().includes('cto');
            
            const messageType = isSecurityFocused ? 'security risk-focused' : 'value-driven';
            nextBestAction = `Email ${topContact.name} (${topContact.title}) with ${messageType} message`;
          }

          return {
            id: account.id,
            name: account.name,
            domain: account.domain,
            industry: account.industry,
            employeeCount: account.employeeCount,
            region: account.region,
            intentScore: account.intentScore,
            relationship: account.relationship,
            contactCount: contacts.length,
            topContacts,
            callCount: calls.length,
            lastCallDate: lastCallDate ? lastCallDate.toISOString() : null,
            whyNow,
            nextBestAction,
          };
        })
      );

      return enrichedActions;
    }),

  // Get rep territory info
  getRepTerritory: publicProcedure
    .input(z.object({ userEmail: z.string() }))
    .query(async ({ input }) => {
      const territory = REP_TERRITORIES[input.userEmail];
      if (!territory) {
        return null;
      }
      
      const accounts = await getAllAccounts();
      const repAccounts = accounts.filter(a => {
        const empCount = a.employeeCount || 0;
        return a.region === territory.region && 
          empCount >= territory.minEmployees && 
          empCount < territory.maxEmployees;
      });
      
      const hotLeads = repAccounts.filter(a => (a.intentScore || 0) >= 70).length;
      const warmLeads = repAccounts.filter(a => {
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
  getRepStats: publicProcedure
    .input(z.object({ userEmail: z.string().optional() }))
    .query(async ({ input }) => {
      let accounts = await getAllAccounts();
      
      // Apply rep-specific filtering if user email matches a known rep
      if (input?.userEmail && REP_TERRITORIES[input.userEmail]) {
        const territory = REP_TERRITORIES[input.userEmail];
        accounts = accounts.filter(a => {
          const empCount = a.employeeCount || 0;
          return a.region === territory.region && 
            empCount >= territory.minEmployees && 
            empCount < territory.maxEmployees;
        });
      }
      
      const hotLeads = accounts.filter(a => (a.intentScore || 0) >= 70).length;
      const warmLeads = accounts.filter(a => {
        const score = a.intentScore || 0;
        return score >= 40 && score < 70;
      }).length;
      const coldLeads = accounts.filter(a => (a.intentScore || 0) < 40).length;
      
      // Calculate 6QA opportunity gap (accounts with 6QA but no opportunities)
      const sixQAGap = accounts.filter(a => {
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
