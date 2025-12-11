import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAllAccounts, getContactsByAccountId, getGongCallsByAccountId } from "./db";

export const priorityActionsRouter = router({
  getEnriched: publicProcedure
    .input(z.object({ limit: z.number().default(3) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 3;
      const accounts = await getAllAccounts();
      
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
});
