export const COOKIE_NAME = "session";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const AXIOS_TIMEOUT_MS = 30000;
export const UNAUTHED_ERR_MSG = "You must be logged in to access this resource";
export const NOT_ADMIN_ERR_MSG = "You must be an admin to access this resource";

export const APP_TITLE = "TargetDash";
export const APP_LOGO = "/logo.png";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  if (typeof window === 'undefined') return '';
  
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  if (!oauthPortalUrl || !appId) return '';
  
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
