import { Express, Request, Response } from "express";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getCompanyConfig } from "./config";

// Store approval tokens (in production, use Redis or database)
const approvalTokens = new Map<string, { userId: number; action: "approve" | "deny"; expiresAt: Date }>();

// Generate a secure token for one-click approval
export function generateApprovalToken(userId: number, action: "approve" | "deny"): string {
  const token = crypto.randomBytes(32).toString("hex");
  approvalTokens.set(token, {
    userId,
    action,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
  return token;
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

export function registerAdminApprovalRoutes(app: Express) {
  // One-click approve endpoint
  app.get("/api/admin/approve/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const tokenData = approvalTokens.get(token);
      
      if (!tokenData) {
        return res.status(400).send(renderResultPage("Invalid or Expired Link", "This approval link is invalid or has already been used.", false));
      }
      
      if (tokenData.expiresAt < new Date()) {
        approvalTokens.delete(token);
        return res.status(400).send(renderResultPage("Link Expired", "This approval link has expired. Please use the admin panel to approve users.", false));
      }
      
      if (tokenData.action !== "approve") {
        return res.status(400).send(renderResultPage("Invalid Action", "This link is not for approval.", false));
      }
      
      const db = await getDb();
      if (!db) {
        return res.status(500).send(renderResultPage("Database Error", "Could not connect to database.", false));
      }
      
      // Get user info before approving
      const [user] = await db.select().from(users).where(eq(users.id, tokenData.userId));
      
      if (!user) {
        approvalTokens.delete(token);
        return res.status(404).send(renderResultPage("User Not Found", "The user no longer exists.", false));
      }
      
      if (user.isApproved) {
        approvalTokens.delete(token);
        return res.status(200).send(renderResultPage("Already Approved", `${user.name} (${user.email}) has already been approved.`, true));
      }
      
      // Approve the user
      await db.update(users).set({ isApproved: true }).where(eq(users.id, tokenData.userId));
      
      // Delete the token after use
      approvalTokens.delete(token);
      
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

  // One-click deny endpoint
  app.get("/api/admin/deny/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const tokenData = approvalTokens.get(token);
      
      if (!tokenData) {
        return res.status(400).send(renderResultPage("Invalid or Expired Link", "This denial link is invalid or has already been used.", false));
      }
      
      if (tokenData.expiresAt < new Date()) {
        approvalTokens.delete(token);
        return res.status(400).send(renderResultPage("Link Expired", "This denial link has expired. Please use the admin panel to manage users.", false));
      }
      
      if (tokenData.action !== "deny") {
        return res.status(400).send(renderResultPage("Invalid Action", "This link is not for denial.", false));
      }
      
      const db = await getDb();
      if (!db) {
        return res.status(500).send(renderResultPage("Database Error", "Could not connect to database.", false));
      }
      
      // Get user info before denying
      const [user] = await db.select().from(users).where(eq(users.id, tokenData.userId));
      
      if (!user) {
        approvalTokens.delete(token);
        return res.status(404).send(renderResultPage("User Not Found", "The user no longer exists.", false));
      }
      
      // Delete the user (deny = remove from system)
      await db.delete(users).where(eq(users.id, tokenData.userId));
      
      // Delete the token after use
      approvalTokens.delete(token);
      
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
