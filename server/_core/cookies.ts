import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  const secure = isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",
    // `SameSite=None` is only legal alongside `Secure`; browsers silently drop
    // a cookie that sets one without the other. Because `secure` is derived
    // from the request, hardcoding "none" meant every plain-HTTP origin — a
    // local `pnpm dev`, an internal deployment behind a non-TLS proxy — issued
    // a cookie the browser threw away. Login appeared to succeed and the next
    // request was already unauthenticated.
    //
    // "none" is still used over HTTPS, where the app may be framed or called
    // cross-site. Otherwise "lax" keeps the session working for top-level
    // navigation and same-origin XHR, which is all this app needs.
    sameSite: secure ? "none" : "lax",
    secure,
  };
}
