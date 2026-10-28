import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { assertServerEnv } from "./env";
import { pingDb } from "../db";
import { serveStatic, setupVite } from "./vite";

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
  assertServerEnv();
  await pingDb();
  console.log("[Database] Connection OK");
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);
  // CSP is off because Vite's dev server injects inline scripts; everything else in helmet's defaults stays on.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  // Attachments travel as base64 inside tRPC calls (10 MB file ~ 14 MB), so only the API gets the large limit.
  app.use("/api/trpc", express.json({ limit: "15mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  const limiter = (options: { windowMs: number; limit: number; skipSuccessfulRequests?: boolean }) =>
    rateLimit({
      ...options,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      // The website talks tRPC, so a plain JSON error is unreadable to it. Answer in tRPC's format, one error per call in a batch,
      // with a message the page can show as it is ("Too many attempts. Try again in 12 minutes.").
      handler: (req, res, _next, optionsUsed) => {
        const resetTime = (req as typeof req & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
        const retryAfterSeconds = Math.max(1, Math.ceil((resetTime ? resetTime.getTime() - Date.now() : optionsUsed.windowMs) / 1000));
        const minutes = Math.ceil(retryAfterSeconds / 60);
        const message = `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
        const calls = (req.path.split("/").filter(Boolean).pop() ?? "").split(",").length;
        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(429).json(Array.from({ length: calls }, () => ({ error: { json: { message, code: -32029, data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 } } } })));
      },
    });
  // Relaxed outside production so local test runs do not lock you out.
  const authLimiter = limiter({ windowMs: 15 * 60_000, limit: process.env.NODE_ENV === "production" ? 10 : 1000, skipSuccessfulRequests: true });
  const registerLimiter = limiter({ windowMs: 60 * 60_000, limit: 10 });
  const trackLimiter = limiter({ windowMs: 60_000, limit: 30 });
  const messageLimiter = limiter({ windowMs: 60_000, limit: 30 });
  const apiLimiter = limiter({ windowMs: 60_000, limit: 600 });
  // httpBatchLink can join procedure names in one URL (a.b,c.d), so match on the path text, not a route.
  app.use("/api/trpc", (req, res, next) => {
    if (req.path.includes("auth.login") || req.path.includes("auth.changePassword")) return authLimiter(req, res, next);
    if (req.path.includes("auth.register")) return registerLimiter(req, res, next); // also covers auth.registerStaff
    if (req.path.includes("complaints.track")) return trackLimiter(req, res, next);
    if (req.path.includes("messages.send")) return messageLimiter(req, res, next);
    return apiLimiter(req, res, next);
  });
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
  // A silently shifted port breaks bookmarks and proxies, so only auto-shift in development.
  const port = process.env.NODE_ENV === "production" ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(error => {
  console.error("[Startup] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
