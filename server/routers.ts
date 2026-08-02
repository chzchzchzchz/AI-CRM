import { COOKIE_NAME } from "@shared/const";
import { isDecisionMaker } from "@shared/taxonomy";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import bcrypt from "bcryptjs";
import { users, accessRequests, Account, Contact, Call } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { z } from "zod";
import { getAllAccounts, getAccountById, updateAccount, getAllPeople, getPeoplePaginated, getPeopleByCompany, getContactsByAccountId, getPersonById, /* createClayRequest, updateClayRequest, getAllClayRequests, getClayRequest, */ upsertAccount, upsertPerson, getAllGongCalls, getGongCallsPaginated, getGongCallsByCompany, getGongCallsByAccountId, getAllOpportunities, getOpportunityById, getOpportunitiesByAccountId, upsertOpportunity } from "./db";
import { enrichAccountWithAI, analyzeGongCall, generateOutreachEmail, intelligentSearch, prioritizeContacts } from "./ai";
import { enrichAccount } from "./sixsense";
import { conversationWithMemory, generateAccountSummary, generateContactSummary } from "./aiContext";
import { clayImportRouter } from "./clay-import";
import { clayWebhookRouter } from "./clay-webhook";
import { intentScoresRouter, zapierRouter, clayPullRouter, integrationsRouter } from "./integrations-router";
import { calls as callsTable } from "../drizzle/schema";
import { sequencesRouter } from "./sequences";
import { rfpRouter } from "./rfp-scraper";
import { outreachRouter } from "./outreach";
import { geminiRouter } from "./gemini";
import { clayRouter } from "./clay";
import { validationRouter } from "./validation-router";
import { priorityActionsRouter } from "./priority-actions-router";
import { bulkInsightsRouter } from "./bulk-insights-router";
import { intelRouter } from "./intel/router";
import { sixsenseRouter } from "./sixsense-router";
import { sixsenseAnalyticsRouter } from "./sixsense-analytics";
import { csvProcessorRouter } from "./csv-processor-router";
import { deepThink, deepThinkSales, deepThinkHelp } from "./deep-think";
import { toolsRouter } from "./tools-router";
import { adminRouter } from "./admin-router";
import { emailVerificationRouter } from "./email-verification-router";
import { followUpsRouter } from "./follow-ups";
import { dustRouter } from "./routers/dust";
import { salesforceRouter } from "./routers/salesforce";
import { notifyOwner } from "./_core/notification";
import { getApprovalLinks } from "./admin-approval-api";
import { hotLeadsRouter } from "./hot-leads-router";
import { recordFailedLogin, clearLoginAttempts, getLoginLockout, validatePasswordComplexity, logSecurityEvent } from "./_core/security";
import { twoFARouter } from "./twofa-router";
import {
  createChallenge,
  claimChallengeAttempt,
  consumeChallenge,
  verifyTotp,
  redeemBackupCode,
  countBackupCodes,
} from "./twofa";

/**
 * Issue the session cookie and return the shape the client expects.
 *
 * Shared by the password-only path and the 2FA path so there is exactly one place a
 * session is minted — the alternative was two copies that could drift, and only one of
 * them behind the second factor.
 */
async function issueSession(
  ctx: { req: any; res: any },
  user: { id: number; openId: string; email: string | null; name: string | null; role: string }
) {
  const db = await getDb();
  if (db) {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  }

  const token = await sdk.createSessionToken(user.openId, {
    expiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    name: user.name || user.email || "",
  });

  ctx.res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    success: true as const,
    twoFactorRequired: false as const,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}


export const appRouter = router({
  intel: intelRouter,
  hotLeads: hotLeadsRouter,
  dust: dustRouter,
  salesforce: salesforceRouter,
  tools: toolsRouter,
  clay: clayRouter,
  gemini: geminiRouter,
  validation: validationRouter,
  priorityActions: priorityActionsRouter,
  bulkInsights: bulkInsightsRouter,
  sixsense: sixsenseRouter,
  csvProcessor: csvProcessorRouter,
  deepThink: router({
    chat: protectedProcedure
      .input(z.object({
        query: z.string(),
        context: z.string().optional(),
        debugMode: z.boolean().optional()
      }))
      .mutation(async ({ input }) => {
        return await deepThink(input);
      }),
    sales: protectedProcedure
      .input(z.object({
        query: z.string(),
        accountData: z.any().optional(),
        contactData: z.any().optional(),
        additionalContext: z.string().optional(),
        debugMode: z.boolean().optional()
      }))
      .mutation(async ({ input }) => {
        // The client (ContextualAI) passes only { id } for the account — never the actual
        // data — so the model was asked about an account it knew nothing about. Hydrate the
        // full, real signal pack from the id here so the answer is grounded.
        let accountData = input.accountData;
        const accountId = accountData?.id;
        if (accountId && Object.keys(accountData).length <= 2) {
          try {
            const { gatherAccountSignals } = await import("./intel/signals");
            accountData = await gatherAccountSignals(Number(accountId));
          } catch (e) {
            console.error("[deepThink.sales] could not hydrate account signals:", e);
          }
        }
        // Feed the continuously-learning workspace brain into every sales-AI answer, so the
        // model reasons with accumulated portfolio knowledge, not just this one record.
        let additionalContext = input.additionalContext;
        try {
          const { getBrainDigest, brainContextBlock } = await import("./intel/brain");
          const digest = await getBrainDigest();
          additionalContext = [brainContextBlock(digest), additionalContext].filter(Boolean).join("\n\n");
        } catch { /* brain unavailable → proceed without it */ }
        return await deepThinkSales({ ...input, accountData, additionalContext });
      }),
    help: protectedProcedure
      .input(z.object({
        query: z.string(),
        debugMode: z.boolean().optional()
      }))
      .mutation(async ({ input }) => {
        return await deepThinkHelp(input);
      }),
  }),
  sixsenseAnalytics: sixsenseAnalyticsRouter,
  analytics: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const isDemoUser = ctx.user?.email?.includes('demo') || false;
      const accounts = await getAllAccounts(isDemoUser);
      const people = await getAllPeople();
      const calls = await getAllGongCalls();

      // Calculate intent score distribution
      const intentScores = accounts
        .map((a: Account) => {
          const score = a.intentScore;
          if (typeof score === 'string') {
            const parsed = parseInt(score, 10);
            return isNaN(parsed) ? null : parsed;
          }
          return score;
        })
        .filter((score: number | null): score is number => score !== null);
      const avgIntentScore = intentScores.length > 0
        ? Math.round(intentScores.reduce((sum: number, score: number) => sum + score, 0) / intentScores.length)
        : 0;

      // Parse rawData for buying stage
      const buyingStages = accounts.reduce((acc: Record<string, number>, account: Account) => {
        let stage = 'Unknown';
        if (account.rawData && typeof account.rawData === 'string') {
          try {
            const data = JSON.parse(account.rawData);
            stage = data['6sense Buying Stage'] || data.buyingStage || 'Unknown';
          } catch {}
        }
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Industry distribution
      const industries = accounts.reduce((acc: Record<string, number>, account: Account) => {
        const industry = account.industry || 'Unknown';
        acc[industry] = (acc[industry] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top accounts by intent score
      const topAccounts = accounts
        .map((a: Account) => ({
          ...a,
          parsedIntentScore: typeof a.intentScore === 'string' ? parseInt(a.intentScore, 10) || 0 : (a.intentScore || 0)
        }))
        .filter((a: Account & { parsedIntentScore: number }) => a.parsedIntentScore > 0)
        .sort((a: Account & { parsedIntentScore: number }, b: Account & { parsedIntentScore: number }) => b.parsedIntentScore - a.parsedIntentScore)
        .slice(0, 10);

      // Gong calls by month
      const callsByMonth = calls.reduce((acc: Record<string, number>, call: Call) => {
        if (call.callDate) {
          const month = new Date(call.callDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return {
        totalAccounts: accounts.length,
        totalContacts: people.length,
        // Computed here, over every contact, because people.list caps at 1,500 of
        // 10,023 — so a page that counts decision makers from its own query is
        // describing a 15% sample under a label that claims the whole book.
        totalDecisionMakers: people.filter((p: any) => isDecisionMaker(p.title)).length,
        totalCalls: calls.length,
        avgIntentScore,
        buyingStages,
        industries,
        topAccounts,
        callsByMonth,
      };
    }),
  }),
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  // Enrolment, status and removal. The login half is auth.login / auth.loginVerify,
  // which cannot live here because they run before a session exists.
  twoFA: twoFARouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    
    // Email/Password Sign Up
    signUp: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Validate password complexity
        const passwordError = validatePasswordComplexity(input.password);
        if (passwordError) {
          throw new Error(passwordError);
        }
        
        // Check if email already exists
        const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing.length > 0) {
          throw new Error("An account with this email already exists");
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(input.password, 10);
        
        // Create user with unique openId
        const openId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        const result = await db.insert(users).values({
          openId,
          email: input.email,
          name: input.name,
          passwordHash,
          loginMethod: "email",
          isApproved: false, // Require admin approval
          role: "user",
        });
        
        // Get the new user ID
        const newUserId = result[0].insertId;
        
        // Send notification to admin for approval with one-click links
        try {
          // Generate one-click approval links
          const baseUrl = process.env.VITE_APP_URL || `http://localhost:${process.env.PORT || 3333}`;
          const { approveUrl, denyUrl } = getApprovalLinks(newUserId, baseUrl);
          
          await notifyOwner({
            title: `🔔 New User Registration: ${input.name}`,
            content: `A new user has registered and is awaiting approval.

**Name:** ${input.name}
**Email:** ${input.email}
**User ID:** ${newUserId}
**Registered:** ${new Date().toISOString()}

---

**One-Click Actions:**

✅ [APPROVE USER](${approveUrl})

❌ [DENY USER](${denyUrl})

---

Or go to the Admin Panel: /admin/approval`
          });
        } catch (notifyError) {
          console.error("Failed to send admin notification:", notifyError);
          // Don't fail the signup if notification fails
        }

        // The id is what lets the client request a verification code for the account it
        // just created. Without it the whole emailVerification router was unreachable —
        // built, tested, and impossible to call.
        //
        // Safe to return: it identifies an account that is not approved and cannot log
        // in, and possessing it proves nothing without the emailed code.
        return { success: true, userId: Number(newUserId) };
      }),
    
    // Email/Password Login
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Get client IP for brute force protection
        const clientIP = ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
                         ctx.req.ip ||
                         ctx.req.socket.remoteAddress ||
                         "unknown";

        // Enforce the brute-force lockout on the tRPC path (the express loginRateLimiter
        // doesn't cover /api/trpc). Without this the 5-attempt lockout was never applied.
        const lockout = getLoginLockout(clientIP);
        if (lockout.locked) {
          logSecurityEvent("LOGIN_LOCKED", { email: input.email, ip: clientIP }, "warn");
          throw new Error(`Too many login attempts. Try again in ${Math.ceil(lockout.retryAfterSeconds / 60)} minute(s).`);
        }

        // Find user by email
        const userResults = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        const user = userResults[0];
        
        if (!user || !user.passwordHash) {
          // Record failed attempt
          recordFailedLogin(clientIP);
          logSecurityEvent("LOGIN_FAILED", { email: input.email, reason: "user_not_found", ip: clientIP }, "warn");
          throw new Error("Invalid email or password");
        }
        
        // Verify password
        const isValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!isValid) {
          // Record failed attempt
          recordFailedLogin(clientIP);
          logSecurityEvent("LOGIN_FAILED", { email: input.email, reason: "invalid_password", ip: clientIP }, "warn");
          throw new Error("Invalid email or password");
        }
        
        // Check if approved
        if (!user.isApproved) {
          throw new Error("Your account is pending approval");
        }
        
        // Clear failed login attempts on successful login
        clearLoginAttempts(clientIP);

        // The password was right. If this account has a second factor, that is not
        // enough on its own — issue a short-lived challenge instead of a session.
        // Before this existed, twoFactorEnabled was written by the settings page and
        // read by nothing: a user could turn 2FA on, see it confirmed, and still be
        // signed in by password alone.
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          logSecurityEvent(
            "LOGIN_2FA_REQUIRED",
            { email: input.email, userId: user.id, ip: clientIP },
            "info"
          );
          return {
            success: false as const,
            twoFactorRequired: true as const,
            challengeId: createChallenge(user.id),
          };
        }

        logSecurityEvent("LOGIN_SUCCESS", { email: input.email, userId: user.id, ip: clientIP }, "info");
        return issueSession(ctx, user);
      }),

    /**
     * Second step of a 2FA login: exchange a challenge plus a code for a session.
     *
     * Public by necessity — there is no session yet, which is the whole point. What
     * stands in for one is the challenge: five minutes, five attempts, destroyed on
     * use, and only ever issued after a correct password.
     *
     * The predecessor of this procedure was `twoFA.verify`, a protectedProcedure. It
     * could only be called by someone already signed in, so it could not have been
     * part of any login.
     */
    loginVerify: publicProcedure
      .input(
        z.object({
          challengeId: z.string().min(16),
          code: z.string().min(6),
          // A recovery code is the way back in when the phone is gone.
          isBackupCode: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const claim = claimChallengeAttempt(input.challengeId);
        if (!claim.ok) {
          throw new Error(
            claim.reason === "exhausted"
              ? "Too many incorrect codes. Sign in again to start over."
              : "That sign-in attempt expired. Enter your password again."
          );
        }

        const [user] = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
        if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
          throw new Error("Two-factor authentication is not enabled for this account");
        }

        if (input.isBackupCode) {
          const redeemed = await redeemBackupCode(
            user.twoFactorBackupCodes as string | null,
            input.code
          );
          if (!redeemed.ok) throw new Error("That recovery code is not valid");
          // Spend it before the session is issued: a code that survives its own use
          // is a permanent bypass of the second factor.
          await db
            .update(users)
            .set({ twoFactorBackupCodes: redeemed.remaining })
            .where(eq(users.id, user.id));
          logSecurityEvent(
            "LOGIN_2FA_BACKUP_CODE_USED",
            { userId: user.id, remaining: countBackupCodes(redeemed.remaining) },
            "warn"
          );
        } else if (!verifyTotp(user.twoFactorSecret as string, input.code)) {
          throw new Error("That code is not valid");
        }

        consumeChallenge(input.challengeId);
        logSecurityEvent("LOGIN_SUCCESS", { userId: user.id, method: "2fa" }, "info");
        return issueSession(ctx, user);
      }),

    // Request Access (for demo)
    requestAccess: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1),
        company: z.string().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        // Check if request already exists
        const existing = await db.select().from(accessRequests).where(eq(accessRequests.email, input.email)).limit(1);
        if (existing.length > 0) {
          throw new Error("You have already submitted an access request");
        }
        
        await db.insert(accessRequests).values({
          email: input.email,
          name: input.name,
          company: input.company || null,
          reason: input.reason || null,
          status: "pending",
        });
        
        return { success: true };
      }),
    
    // Admin: List access requests
    listAccessRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Admin access required");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return await db.select().from(accessRequests).orderBy(accessRequests.createdAt);
    }),
    
    // Admin: Approve/Deny access request
    reviewAccessRequest: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        status: z.enum(["approved", "denied"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Admin access required");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const request = await db.select().from(accessRequests).where(eq(accessRequests.id, input.requestId)).limit(1);
        if (request.length === 0) {
          throw new Error("Request not found");
        }
        
        // Update request status
        await db.update(accessRequests).set({
          status: input.status,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        }).where(eq(accessRequests.id, input.requestId));
        
        // If approved, create user account with temporary password
        if (input.status === "approved") {
          const req = request[0];
          const tempPassword = Math.random().toString(36).substring(2, 10);
          const passwordHash = await bcrypt.hash(tempPassword, 10);
          const openId = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          
          await db.insert(users).values({
            openId,
            email: req.email,
            name: req.name,
            passwordHash,
            loginMethod: "demo",
            isApproved: true,
            role: "user",
          });

          // Deliver the temp password by email. Only echo it in the API response in demo
          // mode — returning credentials to the caller in production is a leak.
          const { sendAccessApprovalEmail } = await import("./_core/email");
          await sendAccessApprovalEmail(req.email, req.name, tempPassword).catch(() => false);
          return process.env.DEMO_MODE === "true"
            ? { success: true, tempPassword }
            : { success: true };
        }
        
        return { success: true };
      }),
  }),

  accounts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const isDemoUser = ctx.user?.email?.includes('demo') || false;
      return await getAllAccounts(isDemoUser);
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getAccountById(input.id);
      }),
    getStats: protectedProcedure.query(async ({ ctx }) => {
      const isDemoUser = ctx.user?.email?.includes('demo') || false;
      const accounts = await getAllAccounts(isDemoUser);
      const people = await getAllPeople();
      const calls = await getAllGongCalls();
      
      // Calculate hot leads (intent score >= 70)
      const hotLeads = accounts.filter((a: Account) => {
        const score = typeof a.intentScore === 'string' ? parseInt(a.intentScore, 10) : a.intentScore;
        return score && score >= 70;
      }).length;
      
      // Calculate warm leads (intent score 40-69)
      const warmLeads = accounts.filter((a: Account) => {
        const score = typeof a.intentScore === 'string' ? parseInt(a.intentScore, 10) : a.intentScore;
        return score && score >= 40 && score < 70;
      }).length;
      
      return {
        totalAccounts: accounts.length,
        hotLeads,
        warmLeads,
        totalContacts: people.length,
        // Counted here, over every contact, because people.list caps at 1,500 of
        // 10,023 — so a page counting decision makers from its own query describes a
        // 15% sample under a label that claims the whole book. Both /insights and
        // /contacts read this field, which is what makes them agree.
        totalDecisionMakers: people.filter((p: any) => isDecisionMaker(p.title)).length,
        totalCalls: calls.length,
      };
    }),
    enrichWith6sense: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.id);
        if (!account?.domain) {
          throw new Error('Account not found or missing domain');
        }

        const { enrichAccount } = await import("./sixsense");
        const data = await enrichAccount(account.domain);
        if (!data) {
          return {
            success: false,
            accountId: input.id,
            message: process.env.SIXSENSE_API_KEY
              ? `No 6sense match for ${account.domain}.`
              : "6sense is not configured (set SIXSENSE_API_KEY).",
          };
        }

        // Persist the enrichment onto the account (only fields 6sense actually returned).
        const updates: Record<string, any> = { lastSixsenseSync: new Date() };
        if (data.industry) updates.industry = data.industry;
        if (data.employeeCount) updates.employeeCount = data.employeeCount;
        if (data.annualRevenue) updates.revenue = String(data.annualRevenue);
        if (data.region) updates.region = data.region;
        if (typeof data.intentScore === "number") updates.intentScore = data.intentScore;
        if (data.buyingStage) updates.sixsenseBuyingStage = data.buyingStage;
        if (data.profileFit) updates.sixsenseProfileFit = data.profileFit;
        if (data.sixsenseId) updates.sixsenseId = data.sixsenseId;
        if (data.segments?.length) updates.sixsenseSegments = JSON.stringify(data.segments);
        await updateAccount(input.id, updates as any);

        return { success: true, accountId: input.id, enrichment: data, message: "Account enriched from 6sense." };
      }),
    getTimeline: protectedProcedure
      .input(z.object({ accountId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const [account, calls] = await Promise.all([
          getAccountById(input.accountId),
          getGongCallsByAccountId(input.accountId)
        ]);
        
        if (!account) {
          throw new Error('Account not found');
        }
        
        // Build activities from calls
        const activities: Array<{
          id: string;
          type: 'call' | 'email' | 'meeting' | 'note' | 'intent_spike' | 'engagement';
          title: string;
          description?: string;
          date: Date;
          metadata?: {
            duration?: string;
            sentiment?: 'positive' | 'neutral' | 'negative';
            participants?: string[];
            score?: number;
          };
        }> = [];
        
        // Add calls to timeline
        calls.forEach((call: Call) => {
          activities.push({
            id: `call-${call.id}`,
            type: 'call',
            title: call.title || 'Call',
            // calls have no summary column; surface the real keyTopics instead.
            description: (() => {
              try {
                const t = (call as any).keyTopics;
                const arr = Array.isArray(t) ? t : (t ? JSON.parse(t) : []);
                return Array.isArray(arr) && arr.length ? arr.join(', ').slice(0, 150) : undefined;
              } catch { return undefined; }
            })(),
            date: call.callDate ? new Date(call.callDate) : new Date(),
            metadata: {
              duration: call.duration ? `${Math.floor(call.duration / 60)}m` : undefined,
              sentiment: call.sentiment as any || undefined
            }
          });
        });
        
        // Parse rawData for additional activities (emails, meetings from SFDC)
        if (account.rawData) {
          try {
            const raw = typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData;
            
            // Add intent spike if there was a recent increase
            if (raw.intentScoreChange && raw.intentScoreChange > 10) {
              activities.push({
                id: `intent-${account.id}`,
                type: 'intent_spike',
                title: 'Intent Score Increased',
                description: `Intent score jumped by ${raw.intentScoreChange} points`,
                date: new Date(),
                metadata: {
                  score: raw.intentScoreChange
                }
              });
            }
            
            // Add last activity as engagement
            if (raw.lastActivity && raw.lastActivityDate) {
              activities.push({
                id: `engagement-${account.id}`,
                type: 'engagement',
                title: raw.lastActivity,
                description: `Last recorded activity for ${account.name}`,
                date: new Date(raw.lastActivityDate),
              });
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        // Sort by date descending and limit
        return activities
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, input.limit);
      }),
  }),
  
  opportunities: router({
    list: protectedProcedure.query(async () => {
      return await getAllOpportunities();
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getOpportunityById(input.id);
      }),
    getByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await getOpportunitiesByAccountId(input.accountId);
      }),
    upsert: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        accountId: z.number(),
        name: z.string().min(1),
        amount: z.union([z.number(), z.string()]).optional(),
        stage: z.string().optional(),
        status: z.enum(["Open", "Won", "Lost"]).optional(),
        probability: z.number().min(0).max(100).optional(),
        expectedCloseDate: z.union([z.string(), z.date()]).optional(),
        aiSuccessScore: z.number().min(0).max(100).optional(),
        aiInsights: z.string().optional(),
        sfdcOpportunityId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const payload: any = { ...input };
        if (typeof payload.amount === "string") payload.amount = payload.amount.replace(/[^0-9.-]/g, "");
        if (typeof payload.expectedCloseDate === "string" && payload.expectedCloseDate) {
          payload.expectedCloseDate = new Date(payload.expectedCloseDate);
        }
        return await upsertOpportunity(payload);
      }),
    aiScore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const opp = await getOpportunityById(input.id);
        if (!opp) throw new Error("Opportunity not found");

        // Deterministic success score derived from real deal signals (stage
        // progression + stated win probability), not a random number.
        const STAGE_WEIGHT: Record<string, number> = {
          discovery: 0.7, qualification: 0.75, validation: 0.85,
          proposal: 0.9, negotiation: 1.0, "closed won": 1.0, "closed lost": 0,
        };
        const prob = Number((opp as any).probability) || 50;
        const stageKey = String((opp as any).stage || "").toLowerCase();
        const weight = STAGE_WEIGHT[stageKey] ?? 0.8;
        const score = Math.max(5, Math.min(99, Math.round(prob * weight)));

        const amountNum = Number((opp as any).amount) || 0;
        const closeDate = (opp as any).expectedCloseDate
          ? new Date((opp as any).expectedCloseDate).toLocaleDateString()
          : null;
        const insights =
          `${(opp as any).name}: ${(opp as any).stage || "unstaged"} stage at ${prob}% stated win probability` +
          (amountNum ? `, $${amountNum.toLocaleString()} in play` : "") +
          (closeDate ? `, target close ${closeDate}` : "") +
          `. Score weights stated probability by stage progression.`;

        await upsertOpportunity({
          ...opp,
          aiSuccessScore: score,
          aiInsights: insights,
        } as any);

        return { score, insights };
      }),
  }),

  calls: router({
    list: protectedProcedure.query(async () => {
      return await getAllGongCalls();
    }),
    create: protectedProcedure
      .input(z.object({
        accountId: z.number().optional(),
        contactId: z.number().optional(),
        title: z.string(),
        duration: z.number().optional(),
        gongCallId: z.string().optional(),
        sentiment: z.string().optional(),
        keyTopics: z.array(z.string()).optional(),
        actionItems: z.array(z.string()).optional(),
        callDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.insert(callsTable).values({
          accountId: input.accountId ?? null,
          contactId: input.contactId ?? null,
          title: input.title,
          duration: input.duration ?? null,
          gongCallId: input.gongCallId ?? null,
          sentiment: input.sentiment ?? null,
          keyTopics: input.keyTopics ? JSON.stringify(input.keyTopics) : null,
          actionItems: input.actionItems ? JSON.stringify(input.actionItems) : null,
          callDate: input.callDate ? new Date(input.callDate) : new Date(),
        });
        return { success: true };
      }),
    getByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await getGongCallsByAccountId(input.accountId);
      }),
  }),

  people: router({
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getPersonById(input.id);
      }),
    // Bounded by default so the Contacts page doesn't ship all 10k rows (~8MB) on load.
    // A search term filters server-side across the FULL set, so no contact is unreachable
    // even though only a page is returned. Rich client-side filters run over what's returned.
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional(), search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const all = await getAllPeople();
        const q = input?.search?.trim().toLowerCase();
        const cap = input?.limit ?? 1500;
        if (q) {
          const hits = all.filter((c: any) =>
            (c.name || "").toLowerCase().includes(q) ||
            (c.title || "").toLowerCase().includes(q) ||
            (c.company || "").toLowerCase().includes(q) ||
            (c.email || "").toLowerCase().includes(q)
          );
          return hits.slice(0, Math.max(cap, 500));
        }
        return all.slice(0, cap);
      }),
    listPaginated: protectedProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return await getPeoplePaginated(input.limit, input.offset);
      }),
    getByCompany: protectedProcedure
      .input(z.object({ company: z.string() }))
      .query(async ({ input }) => {
        return await getPeopleByCompany(input.company);
      }),
    getByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await getContactsByAccountId(input.accountId);
      }),
    prioritize: protectedProcedure
      .input(z.object({ accountId: z.number().optional() }))
      .query(async ({ input }) => {
        let contacts = input.accountId
          ? await getPeopleByCompany(String(input.accountId))
          : await getAllPeople();
        // Never feed thousands of contacts into a single LLM prompt. Without an account,
        // rank the most senior contacts (a real signal) and cap the set the model scores.
        if (!input.accountId && contacts.length > 60) {
          const rank: Record<string, number> = { "C-Suite": 0, VP: 1, Director: 2, Manager: 3, Individual: 4 };
          contacts = [...contacts]
            .sort((a: any, b: any) => (rank[a.seniority] ?? 5) - (rank[b.seniority] ?? 5))
            .slice(0, 50);
        }
        const account = input.accountId ? await getAccountById(input.accountId) : null;
        return await prioritizeContacts(contacts, account || {});
      }),
  }),

  // claySearch: router({
  //   search: publicProcedure
  //     .input(z.object({ searchQuery: z.string() }))
  //     .mutation(async ({ input }) => {
  //       const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  //       
  //       await createClayRequest(requestId, input.searchQuery);
  //       
  //       const clayWebhookUrl = process.env.CLAY_WEBHOOK_URL;
  //       if (!clayWebhookUrl) {
  //         throw new Error("CLAY_WEBHOOK_URL not configured in environment variables");
  //       }
  //       
  //       try {
  //         const response = await fetch(clayWebhookUrl, {
  //           method: "POST",
  //           headers: { "Content-Type": "application/json" },
  //           body: JSON.stringify({ 
  //             searchQuery: input.searchQuery, 
  //             request_id: requestId 
  //           }),
  //         });
  //         
  //         if (!response.ok) {
  //           throw new Error(`Clay webhook failed: ${response.statusText}`);
  //         }
  //         
  //         return { success: true, requestId, message: "Search sent to Clay" };
  //       } catch (error: any) {
  //         await updateClayRequest(requestId, "error", { error: error.message });
  //         throw error;
  //       }
  //     }),
  //   getStatus: publicProcedure
  //     .input(z.object({ requestId: z.string() }))
  //     .query(async ({ input }) => {
  //       return await getClayRequest(input.requestId);
  //     }),
  //   listRequests: publicProcedure.query(async () => {
  //       return await getAllClayRequests();
  //   }),
  // }),

  gong: router({
    list: protectedProcedure.query(async () => {
      return await getAllGongCalls();
    }),
    listPaginated: protectedProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return await getGongCallsPaginated(input.limit, input.offset);
      }),
    getByCompany: protectedProcedure
      .input(z.object({ company: z.string() }))
      .query(async ({ input }) => {
        return await getGongCallsByCompany(input.company);
      }),
    getByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await getGongCallsByAccountId(input.accountId);
      }),
  }),

  // AI-powered features
  ai: router({
    enrichAccount: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account) throw new Error('Account not found');
        return await enrichAccountWithAI(account);
      }),

    analyzeCall: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .mutation(async ({ input }) => {
        const calls = await getAllGongCalls();
        const call = calls.find((c: Call) => c.id === input.callId);
        if (!call) throw new Error('Call not found');
        return await analyzeGongCall(call);
      }),

    // Documented alias: AI account research (reuses enrichAccountWithAI)
    generateAccountResearch: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account) throw new Error("Account not found");
        return await enrichAccountWithAI(account);
      }),
    // Documented alias: AI outreach recommendation (reuses generateOutreachEmail)
    generateOutreachRecommendation: protectedProcedure
      .input(z.object({ accountId: z.number(), contactId: z.number(), recentActivity: z.string().optional() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account) throw new Error("Account not found");
        const people = await getAllPeople();
        const contact = people.find((p: Contact) => p.id === input.contactId);
        const email = await generateOutreachEmail(account, contact, input.recentActivity);
        return { recommendation: email };
      }),
    generateEmail: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        contactId: z.number(),
        context: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        const people = await getAllPeople();
        const contact = people.find((p: Contact) => p.id === input.contactId);
        if (!account || !contact) throw new Error('Account or contact not found');
        return await generateOutreachEmail(account, contact, input.context);
      }),

    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .mutation(async ({ input }) => {
        return await intelligentSearch(input.query);
      }),

    prioritizeContacts: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        const contacts = await getPeopleByCompany(account?.name || '');
        return await prioritizeContacts(contacts, account);
      }),

    chat: protectedProcedure
      .input(z.object({ 
        query: z.string(),
        accountId: z.number().optional(),
        contactId: z.number().optional(),
        conversationHistory: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string()
        })).optional()
      }))
      .mutation(async ({ input, ctx }) => {
        return await conversationWithMemory({
          query: input.query,
          accountId: input.accountId,
          contactId: input.contactId,
          userId: ctx.user?.id,
          conversationHistory: input.conversationHistory
        });
      }),

    generateAccountSummary: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        return await generateAccountSummary(input.accountId);
      }),

    generateContactSummary: protectedProcedure
      .input(z.object({ contactId: z.number(), includeLinkedIn: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        return await generateContactSummary(input.contactId, input.includeLinkedIn ?? false);
      }),

    // Consolidated account brief. The heavy lifting lives in server/intel: facts are
    // rendered deterministically from every signal we hold, and the model's judgement is
    // validated against those signals before it ships. Kept on this name/shape so existing
    // callers keep working.
    compileOverview: protectedProcedure
      .input(z.object({ accountId: z.number(), forceRefresh: z.boolean().optional() }))
      .query(async ({ input }) => {
        try {
          const { generateAccountBrief } = await import("./intel/brief");
          const brief = await generateAccountBrief(input.accountId, {
            forceRefresh: input.forceRefresh,
          });
          const cacheAge = brief.cached
            ? Math.floor((Date.now() - new Date(brief.generatedAt).getTime()) / 60000)
            : 0;
          return {
            summary: brief.markdown,
            judgement: brief.judgement,
            cached: brief.cached,
            cacheAge,
            metrics: brief.metrics,
            degraded: brief.degraded,
            droppedClaims: brief.validation.dropped,
          };
        } catch (error) {
          console.error("[compileOverview] brief generation failed:", error);
          return null;
        }
      }),

    compileResearch: protectedProcedure
      .input(z.object({ accountId: z.number(), forceRefresh: z.boolean().optional() }))
      .query(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account) throw new Error('Account not found');

        // Check cache first (valid for 24 hours)
        const cacheAge = (account as any).aiCacheUpdatedAt ? Date.now() - new Date((account as any).aiCacheUpdatedAt).getTime() : Infinity;
        const cacheValid = cacheAge < 24 * 60 * 60 * 1000;

        if (!input.forceRefresh && (account as any).aiResearchCache && cacheValid) {
          let cachedData;
          try {
            cachedData = JSON.parse((account as any).aiResearchCache);
          } catch {
            cachedData = { insights: (account as any).aiResearchCache };
          }
          return { ...cachedData, cached: true, cacheAge: Math.floor(cacheAge / (60 * 1000)) };
        }

        // If forceRefresh, clear the cache first
        if (input.forceRefresh) {
          console.log(`[AI Research] Force refresh requested for account ${input.accountId}, clearing cache...`);
          await updateAccount(input.accountId, {
            aiResearchCache: null,
            aiCacheUpdatedAt: null
          } as any);
        }

        // Parse triggers and news from rawData
        let triggers: any = {};
        let newsData: any = {};
        try {
          if (account.triggerEvents) {
            triggers = typeof account.triggerEvents === 'string' ? JSON.parse(account.triggerEvents) : account.triggerEvents;
          }
          if (account.rawData) {
            const raw = typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData;
            newsData = {
              fundraising: raw['Latest Fundraising'],
              fundingGrowth: raw['Latest Funding Growth'],
              news: raw['Most Recent News']
            };
          }
        } catch (e) {
          console.error('Failed to parse research data:', e);
        }

        const researchContext = {
          company: account.name,
          industry: account.industry,
          triggers,
          news: newsData
        };

        const { invokeLLM, llmText, LLM_UNAVAILABLE_NOTE } = await import("./_core/llm");
        const { withRCP } = await import("./ai-system-prompt");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: withRCP("You are a competitive intelligence analyst. Synthesize the research data into a clear narrative covering: 1) Recent trigger events and what they mean, 2) Funding/growth signals and implications, 3) Market position and competitive landscape, 4) Strategic opportunities for engagement. Be concise and actionable.")
            },
            {
              role: "user",
              content: `Compile research insights for this account:\n\n${JSON.stringify(researchContext, null, 2)}`
            }
          ]
        });

        const { content: insights, available } = llmText(response);
        const insightsText = available ? insights : LLM_UNAVAILABLE_NOTE;
        
        const result = {
          insights: insightsText,
          rawTriggers: triggers,
          rawNews: newsData
        };

        // Store in cache
        await updateAccount(input.accountId, {
          aiResearchCache: JSON.stringify(result),
          aiCacheUpdatedAt: new Date()
        } as any);

        return { ...result, cached: false, cacheAge: 0 };
      }),

    // Strategic insights are the judgement half of the same account brief, so both panels
    // share one cached generation instead of each firing its own slow LLM call. The old
    // implementation aggregated contact columns (engagementActivities, salesActivities,
    // daysSinceLastEngagement) that do not exist in the schema, so it fed the model zeros
    // and the model invented the numbers back.
    generateStrategicInsights: protectedProcedure
      .input(z.object({ accountId: z.number(), forceRefresh: z.boolean().optional() }))
      .query(async ({ input }) => {
        try {
          const { generateAccountBrief } = await import("./intel/brief");
          const brief = await generateAccountBrief(input.accountId, {
            forceRefresh: input.forceRefresh,
          });
          // Everything above the facts tables is the interpretation layer.
          const judgement = brief.markdown.split("## Signal Readout")[0];
          const recommendations = judgement
            .replace(/^# Account Brief:.*$/m, "")
            .replace(/^_Generated .*_$/m, "")
            .trim();
          return {
            recommendations,
            cached: brief.cached,
            cacheAge: brief.cached
              ? Math.floor((Date.now() - new Date(brief.generatedAt).getTime()) / 60000)
              : 0,
            degraded: brief.degraded,
          };
        } catch (error) {
          console.error("[generateStrategicInsights] failed:", error);
          return null;
        }
      }),
    analyzeTechStack: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account || !account.techStack) {
          return { categories: {}, raw: "No technology stack data available" };
        }

        // Parse the stack data
        let stackData: any = {};
        try {
          stackData = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
        } catch {
          return { categories: {}, raw: "Invalid technology stack data" };
        }

        // Convert to string for AI analysis
        const stackString = JSON.stringify(stackData, null, 2);

        // Use AI to categorize and filter the tech stack
        const { invokeLLM, llmText } = await import("./_core/llm");
        const { withRCP } = await import("./ai-system-prompt");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: withRCP("You are a technology stack analyst. Analyze the provided technology stack data and categorize it into clear, useful categories. Always include these categories even if empty: MFA Providers, SSO Providers, EDR/Security, CRM, Communication Tools, Development Tools, Cloud Infrastructure. For each category, list the relevant technologies found. If a category has no technologies, explicitly state 'None'. Be concise and filter out noise.")
            },
            {
              role: "user",
              content: `Analyze this technology stack and categorize it:\n\n${stackString}\n\nProvide a clear breakdown with categories.`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "tech_stack_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  mfa: { type: "array", items: { type: "string" } },
                  sso: { type: "array", items: { type: "string" } },
                  edr: { type: "array", items: { type: "string" } },
                  crm: { type: "array", items: { type: "string" } },
                  communication: { type: "array", items: { type: "string" } },
                  development: { type: "array", items: { type: "string" } },
                  cloud: { type: "array", items: { type: "string" } },
                  security: { type: "array", items: { type: "string" } },
                  other: { type: "array", items: { type: "string" } }
                },
                required: ["mfa", "sso", "edr", "crm", "communication", "development", "cloud", "security", "other"],
                additionalProperties: false
              }
            }
          }
        });

        const { content, available } = llmText(response);
        // The raw stack string is a usable answer; the note is not.
        if (!available) {
          return { categories: {}, raw: stackString };
        }

        const categories = JSON.parse(content);
        return { categories, raw: stackString };
      }),
  }),

  // Clay data import
  clayImport: clayImportRouter,
  intentScores: intentScoresRouter,
  zapier: zapierRouter,
  clayPull: clayPullRouter,
  integrations: integrationsRouter,
  sequences: sequencesRouter,
  rfps: rfpRouter,
  clayWebhook: clayWebhookRouter,
  outreach: outreachRouter,
  admin: adminRouter,
  emailVerification: emailVerificationRouter,
  followUps: followUpsRouter,

});

export type AppRouter = typeof appRouter;
