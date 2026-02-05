/**
 * COMPREHENSIVE ACCOUNT EXPORT ROUTER
 * 
 * Exports complete account data with all relationships and enrichments
 */

import { protectedProcedure, router } from '../_core/trpc';
import { eq } from 'drizzle-orm';
import { accounts, contacts, calls, rfps, emailSequences, outreachCampaigns } from '../../drizzle/schema';
import { getDb } from '../db';
import { z } from 'zod';
import { getSequenceContextForAccount } from '../sequences/sequence-detector';
import { getCompanyByDomain } from '../sixsense';
import { getLinkedInProfile, extractLinkedInUsername } from '../linkedin';

const exportInputSchema = z.object({
  accountId: z.number(),
});

interface ComprehensiveAccountExport {
  account: {
    // Basic info
    id: number;
    name: string;
    domain: string | null;
    website: string | null;
    
    // Company details
    industry: string | null;
    employeeCount: number | null;
    revenue: string | null;
    arr: number | null;
    type: string | null;
    location: string | null;
    region: string | null;
    phone: string | null;
    
    // Relationship
    relationship: string | null;
    accountStatus: string | null;
    
    // Salesforce
    sfdcAccountId: string | null;
    
    // Sequence & Campaign
    sequenceType: string | null;
    campaignFocus: string | null;
    buyingStage: string | null;
    
    // Intent & Scoring
    intentScore: number | null;
    
    // Technology
    techStack: string[];
    securityStack: string[];
    
    // Signals
    triggerEvents: string[];
    description: string | null;
    
    // LinkedIn
    linkedinUrl: string | null;
    
    // 6sense data
    sixsense: {
      id: string | null;
      buyingStage: string | null;
      profileFit: string | null;
      intentScore: number | null;
      segments: string[];
      lastSync: string | null;
    } | null;
    
    // AI Insights
    aiOverview: string | null;
    aiInsights: string | null;
    aiResearch: string | null;
    aiCacheUpdatedAt: string | null;
    
    // Metadata
    createdAt: string;
    updatedAt: string;
  };
  
  contacts: Array<{
    id: number;
    name: string;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    email: string | null;
    phone: string | null;
    mobilePhone: string | null;
    directPhone: string | null;
    department: string | null;
    location: string | null;
    linkedinUrl: string | null;
    sfdcContactId: string | null;
    linkedinProfile: {
      headline: string | null;
      summary: string | null;
      currentRole: {
        title: string;
        company: string;
        startYear: number | null;
      } | null;
      previousRoles: Array<{
        title: string;
        company: string;
        years: string;
      }>;
      education: Array<{
        school: string;
        degree: string | null;
      }>;
      skills: string[];
      isOpenToWork: boolean;
      followerCount: number | null;
    } | null;
  }>;
  
  calls: Array<{
    id: number;
    title: string;
    duration: number | null;
    sentiment: string | null;
    keyTopics: string[];
    actionItems: string[];
    recordingUrl: string | null;
    transcriptUrl: string | null;
    callDate: string;
    contactName: string | null;
  }>;
  
  rfps: Array<{
    id: number;
    title: string;
    status: string;
    deadline: string | null;
    budget: string | null;
    requirements: string[];
    submissionDate: string | null;
    winProbability: number | null;
  }>;
  
  emailSequences: Array<{
    id: number;
    name: string;
    status: string;
    emailCount: number;
    openRate: number | null;
    clickRate: number | null;
    replyRate: number | null;
    lastEmailDate: string | null;
  }>;
  
  outreachCampaigns: Array<{
    id: number;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    contactCount: number | null;
  }>;
  
  buyingCommittee: Array<{
    contactId: number;
    name: string;
    title: string;
    role: string;
    influence: string;
    email: string | null;
    linkedinUrl: string | null;
  }>;
  
  sequenceContext: {
    sequenceType: string;
    platformContext: Record<string, unknown>;
  };
  
  summary: {
    totalContacts: number;
    totalCalls: number;
    totalRFPs: number;
    lastActivityDate: string | null;
    engagementScore: number | null;
  };
  
  exportedAt: string;
}

function parseJson(str: string | null | undefined): any {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    if (typeof str === 'string' && str.includes(',')) {
      return str.split(',').map((s) => s.trim());
    }
    return typeof str === 'string' ? [str] : [];
  }
}

export const accountExportRouter = router({
  /**
   * Export comprehensive account data
   */
  exportAccount: protectedProcedure
    .input(exportInputSchema)
    .mutation(async ({ input }): Promise<{ success: boolean; data?: ComprehensiveAccountExport; error?: string }> => {
      try {
        const db = await getDb();
        if (!db) throw new Error('Database not available');

        // Fetch account
        const accountResult = await db
          .select()
          .from(accounts)
          .where(eq(accounts.id, input.accountId));

        const account = accountResult[0];
        if (!account) throw new Error('Account not found');

        // Fetch contacts
        const accountContacts = await db
          .select()
          .from(contacts)
          .where(eq(contacts.accountId, input.accountId));

        // Fetch calls
        const accountCalls = await db
          .select()
          .from(calls)
          .where(eq(calls.accountId, input.accountId));

        // Fetch RFPs
        const accountRfps = await db
          .select()
          .from(rfps)
          .where(eq(rfps.accountId, input.accountId));

        // Fetch email sequences
        const accountSequences = await db
          .select()
          .from(emailSequences)
          .where(eq(emailSequences.createdBy, 1)); // TODO: Filter by account

        // Fetch outreach campaigns
        const accountCampaigns = await db
          .select()
          .from(outreachCampaigns);

        // Get 6sense data
        let sixsenseData = null;
        if (account.domain) {
          try {
            const sixsense = await getCompanyByDomain(account.domain);
            if (sixsense) {
              sixsenseData = {
                id: sixsense.company?.companyId || account.sixsenseId || null,
                buyingStage: sixsense.buying_stage || account.sixsenseBuyingStage || null,
                profileFit: sixsense.profile_fit || account.sixsenseProfileFit || null,
                intentScore: sixsense.intent_score || null,
                segments: parseJson(account.sixsenseSegments),
                lastSync: new Date().toISOString(),
              };
            }
          } catch (e) {
            sixsenseData = {
              id: account.sixsenseId || null,
              buyingStage: account.sixsenseBuyingStage || null,
              profileFit: account.sixsenseProfileFit || null,
              intentScore: null,
              segments: parseJson(account.sixsenseSegments),
              lastSync: null,
            };
          }
        }

        // Get LinkedIn profiles for contacts
        const enrichedContacts = await Promise.all(
          accountContacts.map(async (contact: any) => {
            let linkedinProfile = null;
            if (contact.linkedinUrl) {
              try {
                const username = extractLinkedInUsername(contact.linkedinUrl);
                if (username) {
                  const profile = await getLinkedInProfile(username);
                  if (profile) {
                    linkedinProfile = {
                      headline: profile.headline || null,
                      summary: profile.summary || null,
                      currentRole: profile.positions?.[0]
                        ? {
                            title: profile.positions[0].title,
                            company: profile.positions[0].companyName,
                            startYear: profile.positions[0].startYear || null,
                          }
                        : null,
                      previousRoles: (profile.positions || [])
                        .slice(1, 4)
                        .map((p: any) => ({
                          title: p.title,
                          company: p.companyName,
                          years: `${p.startYear || '?'}-${p.endYear || 'present'}`,
                        })),
                      education: (profile.educations || [])
                        .slice(0, 2)
                        .map((e: any) => ({
                          school: e.schoolName,
                          degree: e.degree || null,
                        })),
                      skills: (profile.skills || [])
                        .slice(0, 10)
                        .map((s: any) => s.name),
                      isOpenToWork: profile.isOpenToWork || false,
                      followerCount: profile.followerCount || null,
                    };
                  }
                }
              } catch (e) {
                linkedinProfile = null;
              }
            }

            return {
              id: contact.id,
              name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
              firstName: contact.firstName,
              lastName: contact.lastName,
              title: contact.title,
              email: contact.email,
              phone: contact.phone,
              mobilePhone: contact.mobilePhone,
              directPhone: contact.directPhone,
              department: contact.department,
              location: contact.location,
              linkedinUrl: contact.linkedinUrl,
              sfdcContactId: contact.sfdcContactId,
              linkedinProfile,
            };
          })
        );

        // Get sequence context
        const sequenceContext = getSequenceContextForAccount({
          sequenceType: account.sequenceType,
          campaignFocus: account.campaignFocus,
          buyingStage: account.buyingStage,
          industry: account.industry,
          name: account.name,
        });

        // Build buying committee
        const buyingCommittee = enrichedContacts.map((c) => ({
          contactId: c.id,
          name: c.name,
          title: c.title || 'Unknown',
          role: c.department || 'Unknown',
          influence: 'High',
          email: c.email,
          linkedinUrl: c.linkedinUrl,
        }));

        // Calculate engagement score
        const lastActivityDate = [
          ...accountCalls.map((c: any) => c.callDate),
          ...accountSequences.map((s: any) => s.lastEmailDate),
        ]
          .filter(Boolean)
          .sort()
          .pop();

        const engagementScore = Math.min(
          100,
          (accountCalls.length * 10 + enrichedContacts.length * 5 + (account.intentScore || 0)) / 2
        );

        // Build export
        const exportData: ComprehensiveAccountExport = {
          account: {
            id: account.id,
            name: account.name,
            domain: account.domain,
            website: account.website,
            industry: account.industry,
            employeeCount: account.employeeCount,
            revenue: account.revenue,
            arr: account.arr,
            type: account.type,
            location: account.location,
            region: account.region,
            phone: account.phone,
            relationship: account.relationship,
            accountStatus: account.accountStatus,
            sfdcAccountId: account.sfdcAccountId,
            sequenceType: account.sequenceType,
            campaignFocus: account.campaignFocus,
            buyingStage: account.buyingStage,
            intentScore: account.intentScore,
            techStack: parseJson(account.techStack),
            securityStack: parseJson(account.securityStack),
            triggerEvents: parseJson(account.triggerEvents),
            description: account.description,
            linkedinUrl: account.linkedinUrl,
            sixsense: sixsenseData,
            aiOverview: account.aiOverviewCache,
            aiInsights: account.aiInsightsCache,
            aiResearch: account.aiResearchCache,
            aiCacheUpdatedAt: account.aiCacheUpdatedAt?.toISOString() || null,
            createdAt: account.createdAt.toISOString(),
            updatedAt: account.updatedAt.toISOString(),
          },
          contacts: enrichedContacts,
          calls: accountCalls.map((c: any) => ({
            id: c.id,
            title: c.title,
            duration: c.duration,
            sentiment: c.sentiment,
            keyTopics: parseJson(c.keyTopics),
            actionItems: parseJson(c.actionItems),
            recordingUrl: c.recordingUrl,
            transcriptUrl: c.transcriptUrl,
            callDate: c.callDate.toISOString(),
            contactName: enrichedContacts.find((ct: any) => ct.id === c.contactId)?.name || null,
          })),
          rfps: accountRfps.map((r: any) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            deadline: r.deadline?.toISOString() || null,
            budget: r.budget,
            requirements: parseJson(r.requirements),
            submissionDate: r.submissionDate?.toISOString() || null,
            winProbability: r.winProbability,
          })),
          emailSequences: accountSequences.map((s: any) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            emailCount: s.emailCount || 0,
            openRate: s.openRate,
            clickRate: s.clickRate,
            replyRate: s.replyRate,
            lastEmailDate: s.lastEmailDate?.toISOString() || null,
          })),
          outreachCampaigns: accountCampaigns.map((c: any) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            startDate: c.startDate?.toISOString() || null,
            endDate: c.endDate?.toISOString() || null,
            contactCount: c.contactCount,
          })),
          buyingCommittee,
          sequenceContext: {
            sequenceType: sequenceContext.type,
            platformContext: sequenceContext.platformContext,
          },
          summary: {
            totalContacts: enrichedContacts.length,
            totalCalls: accountCalls.length,
            totalRFPs: accountRfps.length,
            lastActivityDate: lastActivityDate?.toISOString() || null,
            engagementScore: Math.round(engagementScore),
          },
          exportedAt: new Date().toISOString(),
        };

        return { success: true, data: exportData };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),
});
