import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM, llmText, LLM_UNAVAILABLE_NOTE } from "./_core/llm";
import { wrapUntrusted, INJECTION_GUARD, stripLeakedFence } from "./_core/untrusted";
import { eq, inArray } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";

import { getCompanyConfig } from "./config";

// Clean email generation prompt - NO tracking, NO scoring, NO internal data mentions
function getCleanEmailSystemPrompt(): string {
  const config = getCompanyConfig();
  const competitorsList = config.competitors
    ? config.competitors.split(',').slice(0, 2).map(c => c.trim()).join('/')
    : 'traditional solutions';

  return `You are an elite Enterprise Account Executive for ${config.companyName}, a company specializing in ${config.industry}.

CRITICAL RULES FOR EMAILS:
1. NEVER mention "intent score", "6sense", "tracking", "we noticed you're researching", or any data that reveals surveillance
2. NEVER mention internal scoring, buying stages, or analytics
3. NEVER say things like "your 97 intent score" or "based on our data"
4. DO reference their tech stack, company size, industry - things that are publicly known
5. DO reference their likely pain points based on their tech stack (${competitorsList} = legacy solutions, integration pain, etc.)
6. BE HUMAN - write like a real person, not a marketing robot
7. BE SHORT - 3-5 sentences max
8. ONE CLEAR ASK at the end

GOOD: "Given your current tools, you've likely seen issues with scaling..."
BAD: "Your 97 intent score suggests you're actively evaluating solutions..."

GOOD: "Companies with your infrastructure often struggle with..."
BAD: "Based on our 6sense data, we can see you're in the purchase stage..."`;
}

export const outreachRouter = router({
  generateEmail: protectedProcedure
    .input(
      z.object({
        accountIds: z.array(z.number()),
        contactIds: z.array(z.number()).optional(),
        prompt: z.string().optional(),
        templateType: z.enum(["mfa", "sso", "zero-trust", "custom"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch account data
      const accountData = await db
        .select()
        .from(accounts)
        .where(inArray(accounts.id, input.accountIds));

      if (accountData.length === 0) {
        throw new Error("No accounts found");
      }

      const account = accountData[0];

      // Fetch contact data if provided
      let contactData: any[] = [];
      if (input.contactIds && input.contactIds.length > 0) {
        contactData = await db
          .select()
          .from(contacts)
          .where(inArray(contacts.id, input.contactIds));
      }

      const contact = contactData[0];

      // The email is generated in a SINGLE grounded pass below. We deliberately do NOT
      // pre-generate separate account/contact "summaries" here: that added two more LLM
      // round-trips (minutes on a free model) and pulled in the fabricating summary prompts.
      // Everything the email needs is assembled from real columns in `accountContext` below.

      // Build CLEAN context - only publicly known info
      let accountContext = `Company: ${account.name}`;
      if (account.industry) accountContext += `\nIndustry: ${account.industry}`;
      if (account.employeeCount) accountContext += `\nSize: ${account.employeeCount} employees`;
      if (account.region) accountContext += `\nRegion: ${account.region}`;
      
      // Parse tech stack - this is public info
      if (account.techStack) {
        try {
          const stack = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
          if (stack && typeof stack === 'object') {
            const techs = Object.values(stack).flat().filter(Boolean);
            if (techs.length > 0) {
              accountContext += `\nTech Stack: ${techs.slice(0, 8).join(", ")}`;
            }
          }
        } catch (e) {}
      }

      // Parse security stack - this is public info
      if (account.securityStack) {
        try {
          const stack = typeof account.securityStack === 'string' ? JSON.parse(account.securityStack) : account.securityStack;
          if (stack && typeof stack === 'object') {
            const techs = Object.values(stack).flat().filter(Boolean);
            if (techs.length > 0) {
              accountContext += `\nSecurity Stack: ${techs.slice(0, 5).join(", ")}`;
            }
          }
        } catch (e) {}
      }

      // Parse rawData for SSO/MFA info (public)
      let rawData: Record<string, any> = {};
      try {
        if (account.rawData) {
          rawData = typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData;
        }
      } catch (e) {}

      // Add ONLY publicly known info
      if (rawData['SSO Provider']) {
        accountContext += `\nCurrent SSO: ${rawData['SSO Provider']}`;
      }
      if (rawData['MFA Solution']) {
        accountContext += `\nCurrent MFA: ${rawData['MFA Solution']}`;
      }
      // Company description is public
      if (rawData['Company Description']) {
        accountContext += `\nAbout: ${rawData['Company Description'].slice(0, 300)}`;
      }

      // Contact context
      let contactContext = "";
      if (contact) {
        contactContext = `\n\nTarget Contact:
Name: ${contact.name}
Title: ${contact.title || "Unknown"}
Email: ${contact.email || "Unknown"}`;
      }

      const firstName = contact?.name?.split(' ')[0] || "there";

      // ============================================
      // SINGLE PASS: Generate Clean, Professional Email
      // ============================================
      // Built from the deployer's own company config — NOT a hardcoded vendor. The old
      // path asserted "this prospect uses Ping Identity" in every email regardless of the
      // prospect's real stack, which was both a fabrication and prior-employer content.
      const cfg = getCompanyConfig();
      const diffs = cfg.keyDifferentiators?.length
        ? cfg.keyDifferentiators.map((d) => `- ${d.trim()}`).join("\n")
        : "- (configure COMPANY_DIFFERENTIATORS)";
      const emailSystemPrompt = `You are an elite SDR writing on behalf of ${cfg.companyName} (${cfg.industry}).
We sell: ${cfg.productDescription}
Our differentiators:
${diffs}

Write cold outreach that a busy executive would actually reply to.
GROUNDING RULES:
- Use ONLY the prospect facts provided (tech stack, industry, size, signals). Do NOT invent
  the tools they use, their vendors, or their pain points — if a fact is not provided, do
  not assert it.
- Personalize from the real signals given, not from assumptions about their stack.
- Be specific and concise; no marketing filler, no fabricated statistics.` + "\n\n" + INJECTION_GUARD;

      const emailPrompt = `Write a cold email for this prospect.

${wrapUntrusted("prospect account and contact fields", accountContext + contactContext)}

Additional context from rep: ${input.prompt || "Focus on the prospect's likely pain points and our key differentiators."}

REQUIREMENTS:
- Start with "${firstName},"
- 3-5 sentences MAXIMUM
- Reference their tech stack or industry situation naturally
- End with ONE clear ask (15-minute call)
- NO subject line, NO signature
- Sound like a human, not a marketing bot
- Use the account and contact briefs above to deeply personalize the email

OUTPUT ONLY THE EMAIL BODY. Nothing else.`;

      const emailResponse = await invokeLLM({
        messages: [
          { role: "system", content: emailSystemPrompt },
          { role: "user", content: emailPrompt },
        ],
      });

      const { content: emailContent, available } = llmText(emailResponse);

      // `available` is the load-bearing part of this response. Without it the page put
      // the degradation note under a "Ready-to-Send Email" heading and toasted
      // "Email generated!" — a claim that a model wrote something when none was reached.
      return {
        // Same defense as the webinar generator (server/tools-router.ts): a model
        // with nothing real to reference for a missing field can echo the
        // wrapUntrusted fence's own ID back as a stand-in value.
        content: (available ? stripLeakedFence(emailContent) : LLM_UNAVAILABLE_NOTE).trim(),
        available,
        accountCount: accountData.length,
        /** What the draft was actually grounded in, so the page can show its work. */
        groundedIn: {
          account: account.name,
          contact: contact?.name ?? null,
          facts: accountContext
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          repContext: Boolean(input.prompt?.trim()),
        },
      };
    }),

  // Refine an existing email based on feedback
  refineEmail: protectedProcedure
    .input(
      z.object({
        currentEmail: z.string(),
        feedback: z.string(),
        accountName: z.string().optional(),
        contactName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Keep the prospect context in front of the model so a refinement doesn't drift off
      // the account/contact. These inputs were previously accepted but never used.
      const contextLine = [
        input.contactName ? `Recipient: ${input.contactName}` : null,
        input.accountName ? `Company: ${input.accountName}` : null,
      ].filter(Boolean).join(" · ");

      const refinePrompt = `Here is a cold email that needs refinement:
${contextLine ? `\n${contextLine}\n` : ""}
${wrapUntrusted("current draft (previous model output, may be edited)", input.currentEmail)}

${wrapUntrusted("rep feedback", input.feedback)}

Rewrite the email incorporating this feedback${input.contactName ? `, keeping it addressed to ${input.contactName}` : ""}. Keep it:
- 3-5 sentences max
- Human and direct
- One clear ask at the end

OUTPUT ONLY THE REVISED EMAIL. Nothing else.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: getCleanEmailSystemPrompt() },
          { role: "user", content: refinePrompt },
        ],
      });

      // A failed refinement must not replace the rep's draft with an apology — and must
      // not report success either. The page used to toast "Email refined!" on the
      // unavailable path, i.e. claim an edit that never happened.
      const { content, available } = llmText(response);
      return {
        content: available ? stripLeakedFence(content.trim()) : input.currentEmail,
        available,
      };
    }),

  /**
   * WEBINAR PROMO PACK — landing copy, a three-email invite sequence, and two social posts
   * from one paste of the webinar's own material.
   *
   * Lives here rather than in the generic tools router because that copy pasted the
   * webinar deck, the speaker bios and the style guide straight into the prompt with no
   * trust boundary, and collapsed every failure — rate limit, no model, malformed JSON —
   * into one opaque "Failed to generate webinar content". A rep hitting the free-tier
   * limit was told nothing about the limit.
   */
});

function emailShape() {
  return {
    type: "object",
    properties: { subject: { type: "string" }, body: { type: "string" } },
    required: ["subject", "body"],
    additionalProperties: false,
  } as const;
}

export type WebinarContent = {
  landingPage: { headline: string; subheadline: string; bullets: string[]; cta: string };
  emailSequence: Record<"invite" | "reminder" | "lastChance", { subject: string; body: string }>;
  socialPosts: { linkedin: string; twitter: string };
};

/**
 * Accept the model's JSON only if every field the page renders is actually there.
 * A partial object was previously handed straight to the UI, which rendered empty
 * headings and blank cards — a generation that half-failed looked like one that worked.
 */
export function parseWebinarContent(raw: string): WebinarContent | null {
  let obj: any;
  try {
    // Some models wrap JSON in a fenced block.
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    obj = JSON.parse((fenced ? fenced[1] : raw).trim());
  } catch {
    return null;
  }
  const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const email = (e: any) => e && str(e.subject) && str(e.body);

  const lp = obj?.landingPage;
  const seq = obj?.emailSequence;
  const soc = obj?.socialPosts;
  if (!lp || !str(lp.headline) || !str(lp.subheadline) || !str(lp.cta)) return null;
  if (!Array.isArray(lp.bullets) || !lp.bullets.length || !lp.bullets.every(str)) return null;
  if (!seq || !email(seq.invite) || !email(seq.reminder) || !email(seq.lastChance)) return null;
  if (!soc || !str(soc.linkedin) || !str(soc.twitter)) return null;

  return obj as WebinarContent;
}
