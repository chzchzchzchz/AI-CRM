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
  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

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
