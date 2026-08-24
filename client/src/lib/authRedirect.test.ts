// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { redirectToLoginIfUnauthorized } from "./authRedirect";

/**
 * main.tsx used to redirect an unauthorized query/mutation error to getLoginUrl() — an
 * external OAuth portal (VITE_OAUTH_PORTAL_URL) this app has never had configured. That
 * whole mechanism was commented out entirely under the label "no authentication
 * required," which stopped being true the moment this app grew its own email/password +
 * 2FA login. With nothing watching for an expired or missing session, every page's
 * queries failed with UNAUTHED_ERR_MSG and — since most pages derive their lists with
 * `if (!data) return []` (see Accounts.tsx) — rendered an ordinary-looking "0 accounts"
 * empty state instead of sending the visitor to sign in.
 */

const ORIGINAL_LOCATION = window.location;

function setLocation(pathname: string) {
  // window.location is defined read-only in jsdom; redefine the whole property per test
  // rather than assigning into it, which TypeScript (correctly) rejects.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, pathname, href: `http://localhost${pathname}` },
  });
}

beforeEach(() => {
  setLocation("/accounts");
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: ORIGINAL_LOCATION });
});

describe("redirectToLoginIfUnauthorized", () => {
  it("sends an expired/missing session to /login", () => {
    redirectToLoginIfUnauthorized(new TRPCClientError(UNAUTHED_ERR_MSG));
    expect(window.location.href).toBe("/login");
  });

  it("ignores an error that is not the unauthorized signal", () => {
    redirectToLoginIfUnauthorized(new TRPCClientError("Something else went wrong"));
    expect(window.location.href).not.toBe("/login");
  });

  it("ignores a plain Error that never went through tRPC", () => {
    redirectToLoginIfUnauthorized(new Error(UNAUTHED_ERR_MSG));
    expect(window.location.href).not.toBe("/login");
  });

  it("does not redirect again from the login page itself", () => {
    setLocation("/login");
    redirectToLoginIfUnauthorized(new TRPCClientError(UNAUTHED_ERR_MSG));
    expect(window.location.href).not.toBe("/login");
  });

  it("does not redirect from signup either", () => {
    setLocation("/signup");
    redirectToLoginIfUnauthorized(new TRPCClientError(UNAUTHED_ERR_MSG));
    expect(window.location.href).not.toBe("/login");
  });
});
