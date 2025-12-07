export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Target Account Dashboard";
export const APP_LOGO = import.meta.env.VITE_APP_LOGO || "/logo.svg";

export function getLoginUrl(): string {
  const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const currentUrl = window.location.href;
  return `${portalUrl}?app_id=${appId}&redirect_uri=${encodeURIComponent(currentUrl)}`;
}
