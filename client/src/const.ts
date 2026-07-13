export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "TargetDash";
export const APP_LOGO = import.meta.env.VITE_APP_LOGO || "/logo.svg";
// What the in-app help bot tells users to do when it can't help. Customize via env.
export const SUPPORT_CONTACT = import.meta.env.VITE_SUPPORT_CONTACT || "your admin";

export function getLoginUrl(): string {
  const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const currentUrl = window.location.href;
  return `${portalUrl}?app_id=${appId}&redirect_uri=${encodeURIComponent(currentUrl)}`;
}
