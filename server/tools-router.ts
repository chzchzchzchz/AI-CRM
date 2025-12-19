import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { asRevenueArchitect } from "./ai-system-prompt";
import { 
  uploadDocument, 
  searchKnowledgeBase, 
  getRAGContext, 
  trackInteraction, 
  saveGeneratedContent,
  getUserDocuments,
  deleteDocument 
} from "./rag-service";
import { getDb } from "./db";
import { transcriptReports } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

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
  // Knowledge Base endpoints
  uploadDocument: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      content: z.string(),
      mimeType: z.string().default('text/plain'),
      category: z.enum(['battle_card', 'case_study', 'product_sheet', 'competitor_intel', 'playbook', 'general']).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await uploadDocument(
        ctx.user.id,
        input.fileName,
        input.content,
        input.mimeType,
        input.category
      );
      
      await trackInteraction('document_upload', { fileName: input.fileName }, result, {
        userId: ctx.user.id
      });
      
      return result;
    }),

  getDocuments: protectedProcedure
    .query(async ({ ctx }) => {
      return getUserDocuments(ctx.user.id);
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteDocument(input.documentId);
      return { success: true };
    }),

  searchKnowledge: protectedProcedure
    .input(z.object({
      query: z.string(),
      topK: z.number().default(5)
    }))
    .query(async ({ ctx, input }) => {
      return searchKnowledgeBase(input.query, ctx.user.id, input.topK);
    }),

  // Unified content generation with RAG
  generateContent: protectedProcedure
    .input(z.object({
      contentType: z.enum(['email', 'webinar', 'battle_card', 'call_script', 'linkedin']),
      context: z.string(),
      targetAccount: z.string().optional(),
      targetContact: z.string().optional(),
      additionalNotes: z.string().optional(),
      accountId: z.number().optional(),
      contactId: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      
      // Get RAG context from knowledge base
      const ragContext = await getRAGContext(
        `${input.contentType} ${input.context} ${input.targetAccount || ''} ${input.targetContact || ''}`,
        ctx.user.id,
        input.accountId,
        input.contactId
      );
      
      const contentTypePrompts: Record<string, string> = {
        email: 'Generate a personalized sales email that is concise, value-focused, and has a clear call to action.',
        webinar: 'Generate webinar promotional content including headline, key bullets, and email copy.',
        battle_card: 'Generate a competitive battle card with key differentiators, objection handling, and win themes.',
        call_script: 'Generate a discovery/demo call script with opening, key questions, and next steps.',
        linkedin: 'Generate a LinkedIn connection request or InMail message that is professional and personalized.'
      };
      
      const systemPrompt = asRevenueArchitect(`You are a Revenue Architect creating ${input.contentType} content.

${contentTypePrompts[input.contentType]}

Use any relevant context from the knowledge base to make the content more specific and valuable.
${ragContext}`);
      
      const userPrompt = `Create ${input.contentType} content for:

CONTEXT:
${input.context}

${input.targetAccount ? `TARGET ACCOUNT: ${input.targetAccount}` : ''}
${input.targetContact ? `TARGET CONTACT: ${input.targetContact}` : ''}
${input.additionalNotes ? `ADDITIONAL NOTES: ${input.additionalNotes}` : ''}

Generate professional, actionable content.`;
      
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        });
        
        const content = response.choices[0].message.content || '';
        const durationMs = Date.now() - startTime;
        
        // Save generated content
        const contentId = await saveGeneratedContent(
          ctx.user.id,
          input.contentType,
          typeof content === 'string' ? content : JSON.stringify(content),
          {
            title: `${input.contentType} for ${input.targetAccount || 'Unknown'}`,
            accountId: input.accountId,
            contactId: input.contactId,
            promptUsed: userPrompt
          }
        );
        
        // Track interaction
        await trackInteraction('content_generated', input, { contentId, content }, {
          userId: ctx.user.id,
          accountId: input.accountId,
          contactId: input.contactId,
          durationMs
        });
        
        return {
          content: typeof content === 'string' ? content : JSON.stringify(content),
          contentId,
          ragSourcesUsed: ragContext ? true : false,
          durationMs
        };
      } catch (error) {
        console.error('[GenerateContent] Error:', error);
        throw new Error('Failed to generate content');
      }
    }),

  // Data processing with learning
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

  // Feedback endpoint for learning
  submitFeedback: protectedProcedure
    .input(z.object({
      interactionId: z.number().optional(),
      contentId: z.number().optional(),
      feedback: z.enum(['positive', 'negative', 'edited']),
      details: z.string().optional(),
      editedContent: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { interactionId, contentId, feedback, details, editedContent } = input;
      
      // Record feedback on interaction
      if (interactionId) {
        const { recordFeedback } = await import('./rag-service');
        await recordFeedback(interactionId, feedback, details);
      }
      
      // Update generated content with user edits
      if (contentId && editedContent) {
        const db = await (await import('./db')).getDb();
        if (db) {
          const { generatedContent } = await import('../drizzle/schema');
          const { eq } = await import('drizzle-orm');
          await db.update(generatedContent)
            .set({ userEdits: editedContent, feedback })
            .where(eq(generatedContent.id, contentId));
        }
      }
      
      // Track the feedback interaction itself
      await trackInteraction('feedback_submitted', input, { recorded: true }, {
        userId: ctx.user.id
      });
      
      return { success: true };
    }),

  // Get learning insights for a content type
  getLearningInsights: protectedProcedure
    .input(z.object({
      contentType: z.string()
    }))
    .query(async ({ input }) => {
      const { getLearningInsights } = await import('./rag-service');
      return getLearningInsights(input.contentType);
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
    }),

  // Transcript Analysis endpoints
  analyzeTranscript: publicProcedure
    .input(z.object({
      transcript: z.string().min(100, 'Transcript must be at least 100 characters')
    }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      
      const systemPrompt = `You are an expert analyzer of sales call transcripts. Extract specific insights from meeting transcripts.

Rules for extraction:
1. Strict Factuality: Only pull from the transcript. Do not make assumptions.
2. Conciseness: Keep bullet points under 250 characters (except quotes and insights).
3. If information is missing, state "Not mentioned in transcript" or provide empty arrays.
4. Focus on the prospect's perspective.
5. For Security Stack, distinguish between tools they use vs tools they considered.
6. For AI Tools, distinguish enterprise accounts vs individual/free usage.
7. Be specific in risks/challenges - include context and examples from the call.
8. Capture valuable drill-down details in additionalInsights.`;

      const userPrompt = `Analyze this meeting transcript and extract insights:

${input.transcript}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "transcript_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  aboutProspect: {
                    type: "object",
                    properties: {
                      jobTitle: { type: "string" },
                      industry: { type: "string" },
                      companyName: { type: "string" },
                      aiToolsUsed: {
                        type: "object",
                        properties: {
                          enterprise: { type: "array", items: { type: "string" } },
                          other: { type: "array", items: { type: "string" } }
                        },
                        required: ["enterprise", "other"],
                        additionalProperties: false
                      },
                      aiUsageContext: { type: "string" }
                    },
                    required: ["jobTitle", "industry", "companyName", "aiToolsUsed", "aiUsageContext"],
                    additionalProperties: false
                  },
                  topRisks: { type: "array", items: { type: "string" } },
                  topChallenges: { type: "array", items: { type: "string" } },
                  currentSecurityStack: {
                    type: "object",
                    properties: {
                      toolsUsed: { type: "array", items: { type: "string" } },
                      toolsConsidered: { type: "array", items: { type: "string" } }
                    },
                    required: ["toolsUsed", "toolsConsidered"],
                    additionalProperties: false
                  },
                  budgetTimelinePriority: { type: "string" },
                  urgencyDrivers: { type: "string" },
                  feedbackPoints: { type: "array", items: { type: "string" } },
                  betaInterest: {
                    type: "object",
                    properties: {
                      interestLevel: { type: "string" },
                      apprehensions: { type: "string" },
                      interestQuote: { type: "string" }
                    },
                    required: ["interestLevel", "apprehensions", "interestQuote"],
                    additionalProperties: false
                  },
                  topQuotes: { type: "array", items: { type: "string" } },
                  additionalInsights: { type: "array", items: { type: "string" } },
                  nextSteps: { type: "array", items: { type: "string" } }
                },
                required: ["aboutProspect", "topRisks", "topChallenges", "currentSecurityStack", "budgetTimelinePriority", "urgencyDrivers", "feedbackPoints", "betaInterest", "topQuotes", "additionalInsights", "nextSteps"],
                additionalProperties: false
              }
            }
          }
        });

        const messageContent = response.choices[0].message.content;
        const analysis = JSON.parse(typeof messageContent === 'string' ? messageContent : '{}');
        
        const durationMs = Date.now() - startTime;
        console.log(`[TranscriptAnalysis] Completed in ${durationMs}ms`);
        
        return analysis;
      } catch (error) {
        console.error('[TranscriptAnalysis] Error:', error);
        throw new Error('Failed to analyze transcript');
      }
    }),

  saveTranscriptReport: protectedProcedure
    .input(z.object({
      name: z.string(),
      transcript: z.string(),
      analysis: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const result = await db.insert(transcriptReports).values({
        userId: ctx.user.id,
        name: input.name,
        transcript: input.transcript,
        analysis: input.analysis,
        createdAt: new Date()
      });
      return { id: Number((result as any)[0]?.insertId || 0) };
    }),

  getSavedTranscriptReports: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const reports = await db.select().from(transcriptReports)
        .where(eq(transcriptReports.userId, ctx.user.id))
        .orderBy(desc(transcriptReports.createdAt));
      return reports;
    }),

  deleteTranscriptReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(transcriptReports)
        .where(and(
          eq(transcriptReports.id, input.id),
          eq(transcriptReports.userId, ctx.user.id)
        ));
      return { success: true };
    })
});
