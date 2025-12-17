import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { asRevenueArchitect } from "./ai-system-prompt";

// Field name aliases for intelligent mapping
const FIELD_ALIASES: Record<string, string[]> = {
  'firstName': ['firstname', 'first name', 'fname', 'givenname', 'first_name'],
  'lastName': ['surname', 'lastname', 'last name', 'lname', 'familyname', 'last_name'],
  'fullName': ['fullname', 'name', 'contactname', 'full_name'],
  'company': ['organisation', 'organization', 'company', 'account', 'company_name'],
  'jobTitle': ['jobtitle', 'title', 'position', 'job_title'],
  'email': ['email', 'emailaddress', 'e-mail', 'email_address'],
  'phone': ['telephone', 'phone', 'phonenumber', 'phone_number'],
  'country': ['country', 'nation'],
  'address': ['address', 'street', 'streetaddress', 'street_address'],
  'city': ['city', 'town'],
  'state': ['state', 'province', 'region'],
  'postalCode': ['postcode', 'postalcode', 'zip', 'zipcode', 'postal_code'],
  'status': ['status', 'attendance', 'attendance status'],
  'industry': ['industry', 'sector'],
  'employeeCount': ['employeecount', 'company size', 'employees', 'employee_count'],
};

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'aol.com', 'comcast.net', 'icloud.com', 'msn.com', 'live.com'
]);

const UNQUALIFIED_TITLES = [
  'student', 'intern', 'retired', 'unemployed', 'other', 'none', 'n/a'
];

function normalizeFieldName(field: string): string {
  const lower = field.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  for (const [standard, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(a => a.replace(/[^a-z0-9]/g, '') === lower)) {
      return standard;
    }
  }
  return field;
}

function cleanPhoneNumber(phone: string): string {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('1') && p.length === 11) {
    p = p.substring(1);
  }
  if (p.length === 10) {
    return `(${p.slice(0,3)}) ${p.slice(3,6)}-${p.slice(6)}`;
  }
  return p;
}

function cleanCompanyName(company: string): string {
  return String(company || '')
    .replace(/,?\s*(Inc|LLC|Ltd|Corp|Corporation|Incorporated)\.?$/gi, '')
    .trim();
}

function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return PERSONAL_EMAIL_DOMAINS.has(domain);
}

function isUnqualifiedTitle(title: string): boolean {
  const lower = String(title || '').toLowerCase();
  return UNQUALIFIED_TITLES.some(t => lower.includes(t));
}

function parseCSV(content: string): any[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: any = {};
    headers.forEach((h, idx) => {
      row[normalizeFieldName(h)] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

function processLeadData(data: any[]): { cleaned: any[], removed: any[], issues: string[] } {
  const cleaned: any[] = [];
  const removed: any[] = [];
  const issues: string[] = [];
  
  for (const row of data) {
    let shouldRemove = false;
    let removeReason = '';
    
    // Clean phone number
    if (row.phone) {
      row.phone = cleanPhoneNumber(row.phone);
    }
    
    // Clean company name
    if (row.company) {
      row.company = cleanCompanyName(row.company);
    }
    
    // Check for personal email
    if (row.email && isPersonalEmail(row.email)) {
      shouldRemove = true;
      removeReason = `Personal email: ${row.email}`;
    }
    
    // Check for unqualified title
    if (row.jobTitle && isUnqualifiedTitle(row.jobTitle)) {
      shouldRemove = true;
      removeReason = `Unqualified title: ${row.jobTitle}`;
    }
    
    // Check for missing required fields
    if (!row.email && !row.phone) {
      shouldRemove = true;
      removeReason = 'Missing both email and phone';
    }
    
    // Split full name if needed
    if (row.fullName && !row.firstName && !row.lastName) {
      const parts = row.fullName.split(' ');
      row.firstName = parts[0] || '';
      row.lastName = parts.slice(1).join(' ') || '';
    }
    
    // Standardize status
    if (row.status) {
      const s = row.status.toLowerCase();
      if (s.includes('attended')) row.status = 'Attended';
      else if (s.includes('registered') || s.includes('no show')) row.status = 'No Show';
    }
    
    if (shouldRemove) {
      removed.push(row);
      issues.push(removeReason);
    } else {
      cleaned.push(row);
    }
  }
  
  return { cleaned, removed, issues };
}

export const toolsRouter = router({
  processLeads: publicProcedure
    .input(z.object({
      fileContents: z.array(z.string()),
      fileNames: z.array(z.string())
    }))
    .mutation(async ({ input }) => {
      const { fileContents, fileNames } = input;
      
      // Parse all files
      let allData: any[] = [];
      for (let i = 0; i < fileContents.length; i++) {
        const content = fileContents[i];
        const fileName = fileNames[i];
        
        if (fileName.endsWith('.csv')) {
          const parsed = parseCSV(content);
          allData = allData.concat(parsed);
        }
        // For XLSX, we'd need a library - for now just handle CSV
      }
      
      // Process the data
      const { cleaned, removed, issues } = processLeadData(allData);
      
      return {
        originalCount: allData.length,
        cleanedCount: cleaned.length,
        removedCount: removed.length,
        issues,
        cleanedData: cleaned
      };
    }),

  generateWebinarContent: publicProcedure
    .input(z.object({
      contentAssets: z.string(),
      speaker1: z.string().optional(),
      speaker2: z.string().optional(),
      painPoints: z.string().optional(),
      styleGuidelines: z.string().optional(),
      brandContext: z.string().optional(),
      contentType: z.enum(['landing', 'email', 'social', 'all']).default('all')
    }))
    .mutation(async ({ input }) => {
      const { contentAssets, speaker1, speaker2, painPoints, styleGuidelines, brandContext, contentType } = input;
      
      const systemPrompt = asRevenueArchitect(`You are a B2B marketing content specialist. Generate compelling webinar promotional content.

${brandContext ? `BRAND CONTEXT:\n${brandContext}\n` : ''}
${styleGuidelines ? `STYLE GUIDELINES:\n${styleGuidelines}\n` : ''}

Generate content that:
- Speaks directly to IT/Security decision makers
- Highlights specific pain points and solutions
- Uses speaker credibility effectively
- Creates urgency without being pushy
- Follows B2B best practices for each format`);

      const userPrompt = `Generate webinar promotional content based on:

WEBINAR CONTENT:
${contentAssets}

${speaker1 ? `SPEAKER 1:\n${speaker1}\n` : ''}
${speaker2 ? `SPEAKER 2:\n${speaker2}\n` : ''}
${painPoints ? `TARGET PAIN POINTS:\n${painPoints}\n` : ''}

Generate the following content types: ${contentType === 'all' ? 'landing page, email sequence, social posts' : contentType}

Format your response as JSON with these keys:
- landingPage: { headline, subheadline, bullets: string[], cta }
- emailSequence: { invite: { subject, body }, reminder: { subject, body }, lastChance: { subject, body } }
- socialPosts: { linkedin: string, twitter: string }`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "webinar_content",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  landingPage: {
                    type: "object",
                    properties: {
                      headline: { type: "string" },
                      subheadline: { type: "string" },
                      bullets: { type: "array", items: { type: "string" } },
                      cta: { type: "string" }
                    },
                    required: ["headline", "subheadline", "bullets", "cta"],
                    additionalProperties: false
                  },
                  emailSequence: {
                    type: "object",
                    properties: {
                      invite: {
                        type: "object",
                        properties: {
                          subject: { type: "string" },
                          body: { type: "string" }
                        },
                        required: ["subject", "body"],
                        additionalProperties: false
                      },
                      reminder: {
                        type: "object",
                        properties: {
                          subject: { type: "string" },
                          body: { type: "string" }
                        },
                        required: ["subject", "body"],
                        additionalProperties: false
                      },
                      lastChance: {
                        type: "object",
                        properties: {
                          subject: { type: "string" },
                          body: { type: "string" }
                        },
                        required: ["subject", "body"],
                        additionalProperties: false
                      }
                    },
                    required: ["invite", "reminder", "lastChance"],
                    additionalProperties: false
                  },
                  socialPosts: {
                    type: "object",
                    properties: {
                      linkedin: { type: "string" },
                      twitter: { type: "string" }
                    },
                    required: ["linkedin", "twitter"],
                    additionalProperties: false
                  }
                },
                required: ["landingPage", "emailSequence", "socialPosts"],
                additionalProperties: false
              }
            }
          }
        });

        const messageContent = response.choices[0].message.content;
        const content = JSON.parse(typeof messageContent === 'string' ? messageContent : '{}');
        return content;
      } catch (error) {
        console.error('[WebinarContent] Error:', error);
        throw new Error('Failed to generate webinar content');
      }
    })
});
