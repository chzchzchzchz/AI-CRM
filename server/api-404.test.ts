import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { registerApiNotFound } from "./_core/api-404";

/**
 * An unknown /api path came back 200 with the app's HTML.
 *
 * The SPA catch-all (`app.use("*")` → index.html) is correct for client routes and wrong
 * for /api, which fell through to it. Confirmed against a running server before the fix:
 *
 *     /api/redy            200  text/html
 *     /api/does-not-exist  200  text/html
 *     /api/admin/approve   200  text/html   (a real route with its :token lost)
 *
 * The consequence that matters is in render.yaml: the deploy is gated on
 * `healthCheckPath`, so one typo there meant the platform got 200 for a path that did
 * not exist and every deploy passed its health check regardless of state.
 *
 * This drives a real Express app with the real middleware order, because the ordering IS
 * the fix — calling the handler directly would pass just as happily while mounted in the
 * wrong place.
 */

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();

  // A stand-in for the real API surface: one exact route, one with a parameter.
  app.get("/api/ready", (_req, res) => res.json({ ready: true }));
  app.get("/api/admin/approve/:token", (req, res) => res.json({ token: req.params.token }));

  registerApiNotFound(app);

  // The SPA catch-all, exactly as serveStatic() mounts it: 200 + HTML for anything left.
  app.use("*", (_req, res) => res.status(200).type("html").send("<!doctype html><html></html>"));

  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (typeof addr === "string" || addr === null) throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe("unknown /api paths", () => {
  it("404s a mistyped health path instead of rendering the app", async () => {
    // The exact shape of the deploy-gate bug: /api/redy for /api/ready.
    const res = await fetch(`${base}/api/redy`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ error: "Not found", path: "/api/redy" });
  });

  it("404s a route whose parameter went missing", async () => {
    // Mail clients wrap long URLs. Truncated to the bare route, the approval link used
    // to render the dashboard, so the admin saw the app and assumed the click worked.
    const res = await fetch(`${base}/api/admin/approve`);
    expect(res.status).toBe(404);
  });

  it("never answers an unknown /api path with HTML", async () => {
    // The specific failure: res.ok true, body HTML, JSON promised.
    for (const path of ["/api/does-not-exist", "/api/v2/accounts", "/api/"]) {
      const res = await fetch(`${base}${path}`);
      expect(res.ok, `${path} answered ${res.status}`).toBe(false);
      expect(res.headers.get("content-type") ?? "").not.toContain("text/html");
    }
  });

  it("leaves real API routes alone", async () => {
    // A terminator that shadowed the routes above it would trade one silent failure for
    // a much louder one.
    expect(await (await fetch(`${base}/api/ready`)).json()).toEqual({ ready: true });
    expect(await (await fetch(`${base}/api/admin/approve/abc123`)).json()).toEqual({
      token: "abc123",
    });
  });

  it("still serves the SPA for client routes", async () => {
    // /accounts/42 is routed in the browser and MUST keep getting index.html. Scoping
    // this to /api is what makes that still true.
    for (const path of ["/", "/accounts/42", "/login"]) {
      const res = await fetch(`${base}${path}`);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    }
  });

  it("does not catch a client route that merely starts with the letters api", async () => {
    // `app.use("/api")` matches path segments, not prefixes. Worth pinning: switching to
    // a regex or a startsWith check later would break /apiary silently.
    const res = await fetch(`${base}/apiary`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
