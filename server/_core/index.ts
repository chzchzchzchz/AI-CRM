import "dotenv/config";
import express, { Request, Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerAdminApprovalRoutes } from "../admin-approval-api";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { securityHeaders, rateLimiter, corsMiddleware } from "./security";
import { ensureDefaultOrganization } from "./onboarding";
import { checkReadiness } from "./health";
import { registerApiNotFound } from "./api-404";
import { probeStore } from "./shared-store";
import { getDb } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Security middleware - apply first
  app.use(corsMiddleware);
  app.use(securityHeaders);
  // Scoped to /api on purpose. Mounted globally it also counted static assets,
  // and a single page load pulls hundreds of them (bundled chunks and KaTeX
  // fonts in production, every unbundled ES module in dev), so a few refreshes
  // could lock a legitimate user out of their own workspace. Auth endpoints
  // keep their stricter per-account brute-force protection either way.
  app.use("/api", rateLimiter);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Liveness: is the process alive? Deliberately checks nothing external — a database
  // blip must not restart every pod at once and turn a recoverable outage into a
  // thundering herd. This is what the old /api/health actually was; it just claimed more.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', check: 'liveness', timestamp: new Date().toISOString() });
  });

  // Readiness: can this instance actually serve? The old endpoint returned ok
  // unconditionally, so a pod with an unreachable database reported healthy, kept
  // receiving traffic, and left the uptime monitor green through the outage.
  //
  // 503 on failure, because that is the only part a load balancer reads.
  app.get('/api/ready', async (_req: Request, res: Response) => {
    const report = await checkReadiness({ getDb, probeStore });
    res.status(report.ready ? 200 : 503).json(report);
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Admin approval API for one-click email links
  registerAdminApprovalRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Every real API route is mounted by this point. Anything still unmatched under /api
  // is a wrong URL, and must say so — below this line the SPA catch-all answers 200 with
  // index.html, which turned a mistyped health-check path into a deploy gate that could
  // never fail. Ordering is the whole mechanism; see api-404.ts.
  registerApiNotFound(app);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Org 1 is referenced by every existing row in every existing deployment — it is the
  // column default on all 34 tenant tables — and until now it existed only as an integer.
  // Nothing broke because nothing read it; anything that lists organizations or names the
  // workspace you are in would have found the incumbent tenant to be the missing one.
  // Idempotent, and never blocks boot.
  await ensureDefaultOrganization(await getDb());

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production (Docker / managed hosts like Render/Railway/Fly) the platform
  // injects PORT and requires the app to bind to exactly that port, or its health
  // check fails. Only scan for a free port in development, where port clashes are common.
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
