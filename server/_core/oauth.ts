import { COOKIE_NAME, SESSION_MAX_AGE_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk, SDKServer } from "./sdk";
import { ENV } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Development authentication routes (only in non-production)
  if (ENV.devAuthEnabled) {
    app.post("/api/auth/dev-login", async (req: Request, res: Response) => {
      try {
        const { role } = req.body as { role?: "student" | "staff" };

        if (!role || (role !== "student" && role !== "staff")) {
          res.status(400).json({ error: "role must be 'student' or 'staff'" });
          return;
        }

        // Ensure dev users exist
        await sdk.ensureDevUsers();

        const isStudent = role === "student";
        const openId = isStudent ? SDKServer.DEV_STUDENT_OPEN_ID : SDKServer.DEV_STAFF_OPEN_ID;
        const name = isStudent ? "Demo Student" : "Demo Staff";

        // Create session token
        const sessionToken = await sdk.createDevSession(openId, name);

        // Set cookie
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

        // Return user info
        const user = await db.getUserByOpenId(openId);
        res.json({ success: true, user });
      } catch (error) {
        console.error("[DevAuth] Login failed", error);
        res.status(500).json({ error: "Development login failed" });
      }
    });

    app.post("/api/auth/dev-logout", async (req: Request, res: Response) => {
      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      res.json({ success: true });
    });
  }

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_MAX_AGE_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
