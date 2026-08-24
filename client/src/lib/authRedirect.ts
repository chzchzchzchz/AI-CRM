import { UNAUTHED_ERR_MSG } from "@shared/const";
import { TRPCClientError } from "@trpc/client";
import { isBareRoute } from "@/components/app-shell/AppShell";

/**
 * A session that has expired or was never there shows up as every protected query on
 * the page failing with UNAUTHED_ERR_MSG. Nothing was watching for that: AppShell drops
 * the nav chrome when there's no user, but the page underneath still renders — and every
 * page that derives its lists from query data with `if (!data) return []` (the majority
 * of them; see Accounts.tsx) turns that failure into an ordinary-looking "0 accounts, 0
 * contacts" empty state. A signed-out visitor, or a rep whose cookie just expired, saw a
 * blank CRM with no indication they needed to sign back in.
 *
 * A redirect existed for exactly this and was disabled in main.tsx — pointed at an OAuth
 * portal URL (VITE_OAUTH_PORTAL_URL) this app has never used; it has its own
 * email/password + 2FA login at /login. This is that redirect, fixed and wired back up.
 */
export function redirectToLoginIfUnauthorized(error: unknown): void {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (error.message !== UNAUTHED_ERR_MSG) return;
  if (isBareRoute(window.location.pathname)) return;

  window.location.href = "/login";
}
