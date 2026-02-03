import { protectedProcedure, router } from "./_core/trpc";
import { eq } from "drizzle-orm";
import { accounts, contacts, calls, rfps, emailSequences, outreachCampaigns } from "../drizzle/schema";
import { getDb } from "./db";
import { getCompanyByDomain } from "./sixsense";
import { getLinkedInProfile, extractLinkedInUsername } from "./linkedin";
import { z } from "zod";

interface SDRExportPayload {
  account: AccountData;
  contact: ContactData;
  signals: SignalData;
  existingRelationship: RelationshipData;
  buyingCommittee: BuyingCommitteeData[];
  competitiveIntelligence: CompetitiveIntelligenceData;
  rfps: RFPData[];
  emailSequences: EmailSequenceData[];
  outreachHistory: OutreachHistoryData;
  exportedAt: string;
}

interface AccountData {
  id: number;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  revenue: string | null;
  location: string | null;
  region: string | null;
  website: string | null;
  description: string | null;
  techStack: string[];
  securityStack: string[];
  triggerEvents: string[];
  sixsense: {
    id: string | null;
    buyingStage: string | null;
    profileFit: string | null;
    intentScore: number | null;
    segments: string[];
    intentKeywords: string[];
    lastSync: string | null;
  } | null;
  salesforce: {
    accountId: string | null;
    type: string | null;
    owner: string | null;
  } | null;
  recentNews: string[];
  aiInsights: string | null;
}

interface ContactData {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  location: string | null;
  linkedin: {
    url: string | null;
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
  salesforce: {
    contactId: string | null;
  } | null;
}

interface SignalData {
  linkedinPosts: Array<{
    date: string;
    content: string;
    engagement: number | null;
  }>;
  companyNews: Array<{
    date: string;
    headline: string;
    source: string;
  }>;
  jobPostings: Array<{
    title: string;
    posted: string;
    department: string | null;
  }>;
  intentTopics: string[];
}

interface RelationshipData {
  previousCalls: Array<{
    date: string;
    title: string;
    sentiment: string | null;
    summary: string | null;
  }>;
  previousEmails: Array<{
    date: string;
    subject: string;
    opened: boolean;
    replied: boolean;
  }>;
  opportunities: Array<{
    name: string;
    stage: string;
    amount: number | null;
  }>;
  lastContact: string | null;
}

interface BuyingCommitteeData {
  contactId: number;
  name: string;
  title: string;
  role: string;
  influence: string;
  email: string | null;
  linkedinUrl: string | null;
}

interface CompetitiveIntelligenceData {
  primaryCompetitors: string[];
  recentCompetitorNews: Array<{
    date: string;
    headline: string;
    competitor: string;
  }>;
  marketPosition: string | null;
  uniqueValue: string | null;
}

interface RFPData {
  id: number;
  title: string;
  status: string;
  deadline: string | null;
  budget: string | null;
  requirements: string[];
  submissionDate: string | null;
  winProbability: number | null;
}

interface EmailSequenceData {
  id: number;
  name: string;
  status: string;
  emailCount: number;
  openRate: number | null;
  clickRate: number | null;
  replyRate: number | null;
  lastEmailDate: string | null;
}

interface OutreachHistoryData {
  totalOutreaches: number;
  lastOutreach: string | null;
  responseRate: number | null;
  engagementScore: number | null;
  nextBestAction: string | null;
}

function parseJson(str: string | null | undefined): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    if (typeof str === "string" && str.includes(",")) {
      return str.split(",").map((s) => s.trim());
    }
    return typeof str === "string" ? [str] : [];
  }
}

const exportInputSchema = z.object({
  accountId: z.number(),
  contactId: z.number(),
});

export const sdrExportRouter = router({
  export: protectedProcedure
    .input(exportInputSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const accountResult = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, input.accountId));

      const account = accountResult[0];
      if (!account) throw new Error("Account not found");

      const contactResult = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, input.contactId));

      const contact = contactResult[0];
      if (!contact) throw new Error("Contact not found");

      const accountCalls = await db
        .select()
        .from(calls)
        .where(eq(calls.accountId, input.accountId));

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
              segments: parseJson(account.sixsenseSegments) || [],
              intentKeywords: [],
              lastSync: new Date().toISOString(),
            };
          }
        } catch (e) {
          sixsenseData = {
            id: account.sixsenseId || null,
            buyingStage: account.sixsenseBuyingStage || null,
            profileFit: account.sixsenseProfileFit || null,
            intentScore: null,
            segments: parseJson(account.sixsenseSegments) || [],
            intentKeywords: [],
            lastSync: null,
          };
        }
      }

      let linkedinData = null;
      if (contact.linkedinUrl) {
        try {
          const username = extractLinkedInUsername(contact.linkedinUrl);
          if (username) {
            const profile = await getLinkedInProfile(username);
            if (profile) {
              linkedinData = {
                url: contact.linkedinUrl,
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
                    years: `${p.startYear || "?"}-${p.endYear || "present"}`,
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
          linkedinData = null;
        }
      }

      const buyingCommitteeContacts = await db
        .select()
        .from(contacts)
        .where(eq(contacts.accountId, input.accountId));

      const buyingCommittee: BuyingCommitteeData[] = buyingCommitteeContacts.map(
        (c: any) => ({
          contactId: c.id,
          name: c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
          title: c.title || "Unknown",
          role: c.department || "Unknown",
          influence: "High",
          email: c.email,
          linkedinUrl: c.linkedinUrl,
        })
      );

      const accountRfps = await db
        .select()
        .from(rfps)
        .where(eq(rfps.accountId, input.accountId));

      const rfpData: RFPData[] = accountRfps.map((r: any) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        deadline: r.deadline?.toISOString() || null,
        budget: r.budget,
        requirements: parseJson(r.requirements) || [],
        submissionDate: r.submissionDate?.toISOString() || null,
        winProbability: r.winProbability,
      }));

      const accountSequences = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.createdBy, 1));

      const sequenceData: EmailSequenceData[] = accountSequences.map(
        (s: any) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          emailCount: s.emailCount || 0,
          openRate: s.openRate,
          clickRate: s.clickRate,
          replyRate: s.replyRate,
          lastEmailDate: s.lastEmailDate?.toISOString() || null,
        })
      );

      const accountCampaigns = await db
        .select()
        .from(outreachCampaigns)
        ;

      const totalOutreaches = accountCampaigns.length + accountCalls.length;
      const lastOutreach =
        accountCampaigns.length > 0
          ? accountCampaigns[0].createdAt?.toISOString() || null
          : null;

      const payload: SDRExportPayload = {
        account: {
          id: account.id,
          name: account.name,
          domain: account.domain,
          industry: account.industry,
          employeeCount: account.employeeCount,
          revenue: account.revenue,
          location: account.location,
          region: account.region,
          website: account.website,
          description: account.description,
          techStack: parseJson(account.techStack) || [],
          securityStack: parseJson(account.securityStack) || [],
          triggerEvents: parseJson(account.triggerEvents) || [],
          sixsense: sixsenseData,
          salesforce: account.sfdcAccountId
            ? {
                accountId: account.sfdcAccountId,
                type: account.type || null,
                owner: null,
              }
            : null,
          recentNews: [],
          aiInsights: account.aiInsightsCache,
        },
        contact: {
          id: contact.id,
          name:
            contact.name ||
            `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
          firstName: contact.firstName,
          lastName: contact.lastName,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          department: contact.department,
          location: contact.location,
          linkedin: linkedinData,
          salesforce: contact.sfdcContactId
            ? {
                contactId: contact.sfdcContactId,
              }
            : null,
        },
        signals: {
          linkedinPosts: [],
          companyNews: [],
          jobPostings: [],
          intentTopics: sixsenseData?.segments || [],
        },
        existingRelationship: {
          previousCalls: accountCalls.map((c: any) => ({
            date: c.callDate?.toISOString() || new Date().toISOString(),
            title: c.title || "Call",
            sentiment: c.sentiment || null,
            summary: null,
          })),
          previousEmails: [],
          opportunities: [],
          lastContact:
            accountCalls.length > 0
              ? accountCalls[accountCalls.length - 1].callDate?.toISOString() ||
                null
              : null,
        },
        buyingCommittee,
        competitiveIntelligence: {
          primaryCompetitors: [],
          recentCompetitorNews: [],
          marketPosition: null,
          uniqueValue: null,
        },
        rfps: rfpData,
        emailSequences: sequenceData,
        outreachHistory: {
          totalOutreaches,
          lastOutreach,
          responseRate: null,
          engagementScore: null,
          nextBestAction: null,
        },
        exportedAt: new Date().toISOString(),
      };

      return { success: true, data: payload };
    }),
});
