import { Express, Request, Response } from "express";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getCompanyConfig } from "./config";

// Store approval tokens (in production, use Redis or database)
const approvalTokens = new Map<string, { userId: number; action: "approve" | "deny"; expiresAt: Date }>();

// Every live token for a user, so approving or denying can retire the OTHER token for
// the same signup too. The two are meant to be mutually exclusive outcomes of one
// decision — before this, clicking one left the other sitting in the same email, still
// valid for its full 7 days. An admin who approved a user and later re-opened that
// email (cleanup, a "wait, who was this" scroll-back, a forwarded copy) and clicked
// Deny — thinking it was for a different, newer request — deleted an already-approved,
// possibly-active user. Both links also sit in the same email a corporate link-scanner
// GETs to check for malware before a human ever opens it; nothing stopped a scanner
// from resolving both, in either order, and silently deciding the outcome.
const tokensByUser = new Map<number, Set<string>>();

// Generate a secure token for one-click approval
export function generateApprovalToken(userId: number, action: "approve" | "deny"): string {
  const token = crypto.randomBytes(32).toString("hex");
  approvalTokens.set(token, {
    userId,
    action,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
  const forUser = tokensByUser.get(userId) ?? new Set<string>();
  forUser.add(token);
  tokensByUser.set(userId, forUser);
  return token;
}

/** Invalidate every outstanding token for a user — both sides of one approve/deny pair. */
function retireTokensFor(userId: number): void {
  const forUser = tokensByUser.get(userId);
  if (forUser) {
    for (const t of forUser) approvalTokens.delete(t);
    tokensByUser.delete(userId);
  }
}

// Get approval links for a user
export function getApprovalLinks(userId: number, baseUrl: string): { approveUrl: string; denyUrl: string } {
  const approveToken = generateApprovalToken(userId, "approve");
  const denyToken = generateApprovalToken(userId, "deny");

  return {
    approveUrl: `${baseUrl}/api/admin/approve/${approveToken}`,
    denyUrl: `${baseUrl}/api/admin/deny/${denyToken}`,
  };
}

/**
 * Looks up and validates a token shared by both actions below. Centralized so the
 * confirm page (GET) and the actual mutation (POST) apply exactly the same checks —
 * a token good enough to show the confirm page must also be good enough to act on.
 */
async function resolveToken(
  token: string,
  expectedAction: "approve" | "deny"
): Promise<
  | { ok: true; user: typeof users.$inferSelect }
  | { ok: false; page: string; status: number }
> {
  const tokenData = approvalTokens.get(token);

  if (!tokenData) {
    return { ok: false, status: 400, page: renderResultPage("Invalid or Expired Link", `This ${expectedAction === "approve" ? "approval" : "denial"} link is invalid or has already been used.`, false) };
  }
  if (tokenData.expiresAt < new Date()) {
    approvalTokens.delete(token);
    return { ok: false, status: 400, page: renderResultPage("Link Expired", `This ${expectedAction === "approve" ? "approval" : "denial"} link has expired. Please use the admin panel instead.`, false) };
  }
  if (tokenData.action !== expectedAction) {
    return { ok: false, status: 400, page: renderResultPage("Invalid Action", `This link is not for ${expectedAction === "approve" ? "approval" : "denial"}.`, false) };
  }

  const db = await getDb();
  if (!db) {
    return { ok: false, status: 500, page: renderResultPage("Database Error", "Could not connect to database.", false) };
  }

  const [user] = await db.select().from(users).where(eq(users.id, tokenData.userId));
  if (!user) {
    approvalTokens.delete(token);
    return { ok: false, status: 404, page: renderResultPage("User Not Found", "The user no longer exists.", false) };
  }

  return { ok: true, user };
}

export type ApprovalResolution =
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "wrong-action" }
  | { kind: "db-unavailable" }
  | { kind: "user-not-found" }
  | { kind: "already-approved"; user: { name: string | null; email: string | null } }
  | { kind: "approved"; user: { name: string | null; email: string | null } }
  | { kind: "denied"; user: { name: string | null; email: string | null } };

/**
 * The actual decision logic, separated from Express so it's directly testable and so
 * both routes below share one implementation of "resolve this token" rather than two
 * copies that could individually forget to retire the sibling token.
 */
export async function resolveApprovalToken(
  token: string,
  expectedAction: "approve" | "deny"
): Promise<ApprovalResolution> {
  const tokenData = approvalTokens.get(token);
  if (!tokenData) return { kind: "invalid" };

  if (tokenData.expiresAt < new Date()) {
    approvalTokens.delete(token);
    return { kind: "expired" };
  }

  if (tokenData.action !== expectedAction) return { kind: "wrong-action" };

  const db = await getDb();
  if (!db) return { kind: "db-unavailable" };

  // tenancy-exempt: authorized by the unguessable one-click token in the approval link, not by a session
  const [user] = await db.select().from(users).where(eq(users.id, tokenData.userId));
  if (!user) {
    retireTokensFor(tokenData.userId);
    return { kind: "user-not-found" };
  }

  if (expectedAction === "approve") {
    if (user.isApproved) {
      retireTokensFor(tokenData.userId);
      return { kind: "already-approved", user: { name: user.name, email: user.email } };
    }
    // tenancy-exempt: authorized by the unguessable one-click token in the approval link, not by a session
    await db.update(users).set({ isApproved: true }).where(eq(users.id, tokenData.userId));
    retireTokensFor(tokenData.userId);
    return { kind: "approved", user: { name: user.name, email: user.email } };
  }

  // Deny = remove from system.
  // tenancy-exempt: authorized by the unguessable one-click token in the approval link, not by a session
  await db.delete(users).where(eq(users.id, tokenData.userId));
  retireTokensFor(tokenData.userId);
  return { kind: "denied", user: { name: user.name, email: user.email } };
}

export function registerAdminApprovalRoutes(app: Express) {
  // GET renders a confirmation page — it must not itself approve or deny anyone.
  // Email security gateways (Microsoft Safe Links, Proofpoint, Mimecast, and similar)
  // routinely prefetch every link in an inbound email to scan it, which fires a GET
  // before any human ever opens the message. With the mutation on GET, that scan WAS
  // the approval — a real access decision made by a bot, not the admin. The mutation
  // now only happens on the POST triggered by an explicit click on this page.
  app.get("/api/admin/approve/:token", async (req: Request, res: Response) => {
    const result = await resolveToken(req.params.token, "approve");
    if (!result.ok) return res.status(result.status).send(result.page);
    const { user } = result;

    if (user.isApproved) {
      approvalTokens.delete(req.params.token);
      return res.status(200).send(renderResultPage("Already Approved", `${user.name} (${user.email}) has already been approved.`, true));
    }

    return res.status(200).send(renderConfirmPage("approve", req.params.token, user.name ?? user.email ?? "this user", user.email ?? ""));
  });

  app.post("/api/admin/approve/:token", async (req: Request, res: Response) => {
    try {
      const result = await resolveToken(req.params.token, "approve");
      if (!result.ok) return res.status(result.status).send(result.page);
      const { user } = result;

      if (user.isApproved) {
        approvalTokens.delete(req.params.token);
        return res.status(200).send(renderResultPage("Already Approved", `${user.name} (${user.email}) has already been approved.`, true));
      }

      const db = await getDb();
      await db!.update(users).set({ isApproved: true }).where(eq(users.id, user.id));
      approvalTokens.delete(req.params.token);
      retireTokensFor(user.id);

      return res.status(200).send(renderResultPage(
        "User Approved ✓",
        `${user.name} (${user.email}) has been approved and can now access the dashboard.`,
        true
      ));
    } catch (error) {
      console.error("Approval error:", error);
      return res.status(500).send(renderResultPage("Error", "An error occurred while processing the approval.", false));
    }
  });

  app.get("/api/admin/deny/:token", async (req: Request, res: Response) => {
    const result = await resolveToken(req.params.token, "deny");
    if (!result.ok) return res.status(result.status).send(result.page);
    const { user } = result;

    return res.status(200).send(renderConfirmPage("deny", req.params.token, user.name ?? user.email ?? "this user", user.email ?? ""));
  });

  app.post("/api/admin/deny/:token", async (req: Request, res: Response) => {
    try {
      const result = await resolveToken(req.params.token, "deny");
      if (!result.ok) return res.status(result.status).send(result.page);
      const { user } = result;

      // Deny = remove from system.
      const db = await getDb();
      await db!.delete(users).where(eq(users.id, user.id));
      approvalTokens.delete(req.params.token);
      retireTokensFor(user.id);

      return res.status(200).send(renderResultPage(
        "User Denied",
        `${user.name} (${user.email}) has been denied access and removed from the system.`,
        true
      ));
    } catch (error) {
      console.error("Denial error:", error);
      return res.status(500).send(renderResultPage("Error", "An error occurred while processing the denial.", false));
    }
  });
}

/**
 * `renderResultPage`'s `message` argument is built from `user.name` / `user.email` at
 * every call site — fields set at signup with no format restriction beyond
 * `z.string().min(1)`. Interpolated unescaped into `<p>${message}</p>`, a name like
 * `<img src=x onerror=...>` executes in the browser of whoever clicks the one-click
 * approve/deny link from their email — normally an admin, so this is a stored-XSS path
 * into an admin's own session. Escape both dynamic fields at the one place they're
 * rendered, so no future call site can reintroduce this by forgetting to.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c] as string);
}

/** Same interpolation risk as renderResultPage's message — name/email are user-supplied. */
function renderConfirmPage(action: "approve" | "deny", token: string, name: string, email: string): string {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeToken = escapeHtml(token);
  const verb = action === "approve" ? "Approve" : "Deny";
  const color = action === "approve" ? "#10b981" : "#ef4444";
  const description = action === "approve"
    ? "will grant this person access to the dashboard."
    : "will permanently remove this request and delete the pending account.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm ${verb} - ${getCompanyConfig().productName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container { text-align: center; padding: 3rem; max-width: 500px; }
    h1 { font-size: 1.75rem; margin-bottom: 1rem; color: #fff; }
    p { color: #a0a0a0; line-height: 1.6; margin-bottom: 2rem; }
    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: ${color};
      color: #fff;
      border: none;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      font-size: 1rem;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${verb} ${safeName}?</h1>
    <p>${safeName} (${safeEmail}) requested access. Confirming ${description}</p>
    <form method="POST" action="/api/admin/${action}/${safeToken}">
      <button type="submit" class="btn">Yes, ${verb.toLowerCase()}</button>
    </form>
  </div>
</body>
</html>
  `;
}

function renderResultPage(title: string, message: string, success: boolean): string {
  title = escapeHtml(title);
  message = escapeHtml(message);
  const bgColor = success ? "#10b981" : "#ef4444";
  const icon = success ? "✓" : "✕";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${getCompanyConfig().productName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 3rem;
      max-width: 500px;
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      font-size: 2.5rem;
    }
    h1 {
      font-size: 1.75rem;
      margin-bottom: 1rem;
      color: #fff;
    }
    p {
      color: #a0a0a0;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #8b5cf6;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #7c3aed;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/admin/approval" class="btn">Go to Admin Panel</a>
  </div>
</body>
</html>
  `;
}
