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

const LINK_LABEL = { approve: "approval", deny: "denial" } as const;

async function handleApprovalLink(
  action: "approve" | "deny",
  req: Request,
  res: Response
): Promise<void> {
  const label = LINK_LABEL[action];
  try {
    const resolution = await resolveApprovalToken(req.params.token, action);

    switch (resolution.kind) {
      case "invalid":
        res.status(400).send(renderResultPage("Invalid or Expired Link", `This ${label} link is invalid or has already been used.`, false));
        return;
      case "expired":
        res.status(400).send(renderResultPage("Link Expired", `This ${label} link has expired. Please use the admin panel to manage users.`, false));
        return;
      case "wrong-action":
        res.status(400).send(renderResultPage("Invalid Action", `This link is not for ${label}.`, false));
        return;
      case "db-unavailable":
        res.status(500).send(renderResultPage("Database Error", "Could not connect to database.", false));
        return;
      case "user-not-found":
        res.status(404).send(renderResultPage("User Not Found", "The user no longer exists.", false));
        return;
      case "already-approved":
        res.status(200).send(renderResultPage("Already Approved", `${resolution.user.name} (${resolution.user.email}) has already been approved.`, true));
        return;
      case "approved":
        res.status(200).send(renderResultPage(
          "User Approved ✓",
          `${resolution.user.name} (${resolution.user.email}) has been approved and can now access the dashboard.`,
          true
        ));
        return;
      case "denied":
        res.status(200).send(renderResultPage(
          "User Denied",
          `${resolution.user.name} (${resolution.user.email}) has been denied access and removed from the system.`,
          true
        ));
        return;
    }
  } catch (error) {
    console.error(`${action === "approve" ? "Approval" : "Denial"} error:`, error);
    res.status(500).send(renderResultPage("Error", `An error occurred while processing the ${label}.`, false));
  }
}

export function registerAdminApprovalRoutes(app: Express) {
  // One-click approve endpoint
  app.get("/api/admin/approve/:token", (req: Request, res: Response) => handleApprovalLink("approve", req, res));

  // One-click deny endpoint
  app.get("/api/admin/deny/:token", (req: Request, res: Response) => handleApprovalLink("deny", req, res));
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
