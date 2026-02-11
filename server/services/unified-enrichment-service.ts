/**
 * UNIFIED DATA ENRICHMENT SERVICE
 * 
 * Takes a contact or account identifier and searches across ALL integrations:
 * - Salesforce
 * - Gong
 * - 6sense
 * - LinkedIn
 * - Clay
 * - Dust
 * 
 * Normalizes and collates all data, then runs through Claude prompt
 */

import { invokeLLM } from '../_core/llm';
import { query as sfdcQuery, getAccessToken } from '../salesforce-comprehensive';
import { getCompanyByDomain } from '../sixsense';
import { getLinkedInProfile, extractLinkedInUsername } from '../linkedin';

export interface UnifiedEnrichmentInput {
  email?: string;
  name?: string;
  domain?: string;
  linkedinUrl?: string;
  sfdcContactId?: string;
  sfdcAccountId?: string;
}

export interface CollatedData {
  salesforce: {
    contact?: Record<string, any>;
    account?: Record<string, any>;
  };
  gong: {
    calls?: Record<string, any>[];
    insights?: Record<string, any>;
  };
  sixsense: {
    company?: Record<string, any>;
    buyingSignals?: Record<string, any>[];
  };
  linkedin: {
    profile?: Record<string, any>;
    connections?: Record<string, any>[];
  };
  clay?: Record<string, any>;
  dust?: Record<string, any>;
}

/**
 * Search Salesforce for contact and account data
 */
async function searchSalesforce(input: UnifiedEnrichmentInput): Promise<{ contact?: Record<string, any>; account?: Record<string, any> }> {
  try {
    const results: { contact?: Record<string, any>; account?: Record<string, any> } = {};

    // Search by contact ID
    if (input.sfdcContactId) {
      const contactQuery = `SELECT Id, FirstName, LastName, Email, Phone, Title, Department, Account.Id, Account.Name FROM Contact WHERE Id = '${input.sfdcContactId}' LIMIT 1`;
      const contacts = await sfdcQuery(contactQuery);
      if (contacts.length > 0) {
        results.contact = contacts[0] as Record<string, any>;
      }
    }

    // Search by email
    if (input.email && !results.contact) {
      const contactQuery = `SELECT Id, FirstName, LastName, Email, Phone, Title, Department, Account.Id, Account.Name FROM Contact WHERE Email = '${input.email}' LIMIT 1`;
      const contacts = await sfdcQuery(contactQuery);
      if (contacts.length > 0) {
        results.contact = contacts[0] as Record<string, any>;
      }
    }

    // Search by account ID
    if (input.sfdcAccountId) {
      const accountQuery = `SELECT Id, Name, Website, Industry, NumberOfEmployees, BillingCity, BillingState, BillingCountry, Description FROM Account WHERE Id = '${input.sfdcAccountId}' LIMIT 1`;
      const accounts = await sfdcQuery(accountQuery);
      if (accounts.length > 0) {
        results.account = accounts[0] as Record<string, any>;
      }
    }

    // Search by domain
    if (input.domain && !results.account) {
      const accountQuery = `SELECT Id, Name, Website, Industry, NumberOfEmployees, BillingCity, BillingState, BillingCountry, Description FROM Account WHERE Website LIKE '%${input.domain}%' LIMIT 1`;
      const accounts = await sfdcQuery(accountQuery);
      if (accounts.length > 0) {
        results.account = accounts[0] as Record<string, any>;
      }
    }

    return results;
  } catch (error) {
    console.error('Error searching Salesforce:', error);
    return {};
  }
}

/**
 * Search Gong for calls and insights
 */
async function searchGong(input: UnifiedEnrichmentInput): Promise<{ calls?: Record<string, any>[]; insights?: Record<string, any> }> {
  try {
    // TODO: Implement Gong API integration
    // For now, return empty
    return {};
  } catch (error) {
    console.error('Error searching Gong:', error);
    return {};
  }
}

/**
 * Search 6sense for company data and buying signals
 */
async function searchSixsense(input: UnifiedEnrichmentInput): Promise<{ company?: Record<string, any>; buyingSignals?: Record<string, any>[] }> {
  try {
    const results: { company?: Record<string, any>; buyingSignals?: Record<string, any>[] } = {};

    if (input.domain) {
      const company = await getCompanyByDomain(input.domain);
      if (company) {
        results.company = company;
        // Extract buying signals
        results.buyingSignals = [
          {
            type: 'intent_score',
            value: company.intent_score,
            timestamp: new Date().toISOString(),
          },
          {
            type: 'buying_stage',
            value: company.buying_stage,
            timestamp: new Date().toISOString(),
          },
          {
            type: 'profile_fit',
            value: company.profile_fit,
            timestamp: new Date().toISOString(),
          },
        ];
      }
    }

    return results;
  } catch (error) {
    console.error('Error searching 6sense:', error);
    return {};
  }
}

/**
 * Search LinkedIn for profile and connections
 */
async function searchLinkedIn(input: UnifiedEnrichmentInput): Promise<{ profile?: Record<string, any>; connections?: Record<string, any>[] }> {
  try {
    const results: { profile?: Record<string, any>; connections?: Record<string, any>[] } = {};

    // Search by LinkedIn URL
    if (input.linkedinUrl) {
      const username = extractLinkedInUsername(input.linkedinUrl);
      if (username) {
        const profile = await getLinkedInProfile(username);
        if (profile) {
          results.profile = profile;
        }
      }
    }

    // Search by name
    if (input.name && !results.profile) {
      // TODO: Implement LinkedIn profile search by name
      // For now, skip this
    }

    return results;
  } catch (error) {
    console.error('Error searching LinkedIn:', error);
    return {};
  }
}

/**
 * Normalize and collate data from all sources
 */
function normalizeAndCollate(data: CollatedData): string {
  const sections: string[] = [];

  // Salesforce section
  if (data.salesforce.contact || data.salesforce.account) {
    sections.push('## SALESFORCE DATA');
    if (data.salesforce.contact) {
      sections.push(`**Contact:** ${data.salesforce.contact.FirstName} ${data.salesforce.contact.LastName}`);
      sections.push(`- Email: ${data.salesforce.contact.Email}`);
      sections.push(`- Title: ${data.salesforce.contact.Title}`);
      sections.push(`- Department: ${data.salesforce.contact.Department}`);
      sections.push(`- Phone: ${data.salesforce.contact.Phone}`);
    }
    if (data.salesforce.account) {
      sections.push(`**Account:** ${data.salesforce.account.Name}`);
      sections.push(`- Website: ${data.salesforce.account.Website}`);
      sections.push(`- Industry: ${data.salesforce.account.Industry}`);
      sections.push(`- Employees: ${data.salesforce.account.NumberOfEmployees}`);
      sections.push(`- Location: ${data.salesforce.account.BillingCity}, ${data.salesforce.account.BillingState}, ${data.salesforce.account.BillingCountry}`);
    }
  }

  // 6sense section
  if (data.sixsense.company || data.sixsense.buyingSignals?.length) {
    sections.push('\n## 6SENSE INTELLIGENCE');
    if (data.sixsense.company) {
      sections.push(`**Company Profile:**`);
      sections.push(`- Name: ${data.sixsense.company.companyName}`);
      sections.push(`- Industry: ${data.sixsense.company.industry}`);
      sections.push(`- Employees: ${data.sixsense.company.employeeCount}`);
    }
    if (data.sixsense.buyingSignals?.length) {
      sections.push(`**Buying Signals:**`);
      data.sixsense.buyingSignals.forEach((signal) => {
        sections.push(`- ${signal.type}: ${signal.value}`);
      });
    }
  }

  // LinkedIn section
  if (data.linkedin.profile) {
    sections.push('\n## LINKEDIN PROFILE');
    sections.push(`**${data.linkedin.profile.headline}**`);
    if (data.linkedin.profile.positions?.length) {
      sections.push(`**Current Role:** ${data.linkedin.profile.positions[0].title} at ${data.linkedin.profile.positions[0].companyName}`);
    }
    if (data.linkedin.profile.summary) {
      sections.push(`**Summary:** ${data.linkedin.profile.summary.substring(0, 200)}...`);
    }
    if (data.linkedin.profile.skills?.length) {
      sections.push(`**Top Skills:** ${data.linkedin.profile.skills.slice(0, 5).join(', ')}`);
    }
  }

  // Gong section
  if (data.gong.calls?.length) {
    sections.push('\n## GONG CALL INSIGHTS');
    sections.push(`**Recent Calls:** ${data.gong.calls.length}`);
    data.gong.calls.slice(0, 3).forEach((call, i) => {
      sections.push(`- Call ${i + 1}: ${call.title || 'Untitled'} (${call.sentiment || 'Neutral'})`);
    });
  }

  return sections.join('\n');
}

/**
 * Run collated data through Claude prompt for insights
 */
async function generateInsights(collatedData: string, input: UnifiedEnrichmentInput): Promise<string> {
  const prompt = `You are an expert sales intelligence analyst. You have been given data about a contact or account from multiple sources (Salesforce, 6sense, LinkedIn, Gong, etc.).

UNIFIED DATA:
${collatedData}

TASK: Analyze this data and provide:
1. **Executive Summary** - 2-3 sentence overview of who this person/company is
2. **Key Insights** - 3-5 bullet points of the most important findings
3. **Buying Signals** - Any indicators of buying intent or readiness
4. **Recommended Actions** - 2-3 specific next steps for outreach
5. **Risk Factors** - Any red flags or concerns to be aware of

Format your response in clear sections with markdown formatting.`;

  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: 'You are an expert sales intelligence analyst specializing in account and contact research. Provide actionable, concise insights based on available data.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  return 'Unable to generate insights';
}

/**
 * Main unified enrichment function
 */
export async function enrichContact(input: UnifiedEnrichmentInput): Promise<{
  success: boolean;
  collatedData?: CollatedData;
  insights?: string;
  error?: string;
}> {
  try {
    console.log('🔍 Starting unified enrichment for:', input);

    // Search all integrations in parallel
    const [salesforceData, gongData, sixsenseData, linkedinData] = await Promise.all([
      searchSalesforce(input),
      searchGong(input),
      searchSixsense(input),
      searchLinkedIn(input),
    ]);

    // Collate all data
    const collatedData: CollatedData = {
      salesforce: salesforceData,
      gong: gongData,
      sixsense: sixsenseData,
      linkedin: linkedinData,
    };

    console.log('📊 Collated data:', JSON.stringify(collatedData, null, 2));

    // Normalize and prepare for Claude
    const normalizedData = normalizeAndCollate(collatedData);

    // Generate insights via Claude
    const insights = await generateInsights(normalizedData, input);

    console.log('✅ Enrichment complete');

    return {
      success: true,
      collatedData,
      insights,
    };
  } catch (error) {
    console.error('❌ Enrichment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
