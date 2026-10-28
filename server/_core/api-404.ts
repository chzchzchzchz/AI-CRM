import type { Express, Request, Response } from "express";

/**
 * An unknown /api path must 404, not render the app.
 *
 * The single-page app is served by a catch-all (`app.use("*")`) that returns index.html
 * for anything no earlier route claimed. That is right for `/accounts/42` — the router
 * runs in the browser — and wrong for `/api/anything`, which fell through to it and came
 * back **200 OK with text/html**. Confirmed against a running server:
 *
 *     /api/redy            200  text/html   <!doctype html>…
 *     /api/does-not-exist  200  text/html   <!doctype html>…
 *     /api/admin/approve   200  text/html   <!doctype html>…      (real route, :token lost)
 *
 * Every one of those is a failure wearing a success's clothes:
 *
 *   - `render.yaml` gates each deploy on `healthCheckPath`. One typo there and the
 *     platform gets 200 for a path that does not exist, so every deploy passes its
 *     health check no matter how broken the release is — the gate is disabled by a
 *     single character, silently and permanently.
 *   - A truncated approval link (mail clients wrap long URLs) renders the dashboard
 *     shell, so the admin sees the app and assumes the click worked. Nothing was
 *     approved.
 *   - Any caller sees `res.ok === true` and gets HTML where JSON was promised. The
 *     error surfaces later, somewhere else, as a parse failure with no trace of the
 *     wrong URL that caused it.
 *
 * tRPC already answers its own unknown paths correctly; this covers everything else
 * under /api. Mount it AFTER every real API route and BEFORE the SPA handler — the
 * ordering is the entire mechanism, which is why the test drives a real Express app
 * rather than calling this function directly.
 */
export function registerApiNotFound(app: Express): void {
  app.use("/api", (req: Request, res: Response) => {
    res.status(404).json({
      error: "Not found",
      // The path back, because the usual cause is a wrong URL and the caller cannot
      // see which one it sent from a bare 404 body. `req.originalUrl` is echoed by
      // Express's own JSON serializer, so there is no markup context to escape into.
      path: req.originalUrl,
    });
  });
}
