import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

/** Sessions are a signed JWT in an HttpOnly cookie. */
class SessionService {
  private secretKey() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSession(openId: string, name: string): Promise<string> {
    const expirationSeconds = Math.floor((Date.now() + SESSION_MAX_AGE_MS) / 1000);
    return new SignJWT({ openId, name })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.secretKey());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<{ openId: string } | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.secretKey(), { algorithms: ["HS256"] });
      const { openId } = payload as Record<string, unknown>;
      return typeof openId === "string" && openId.length > 0 ? { openId } : null;
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
    const session = await this.verifySession(token);
    if (!session) throw ForbiddenError("Invalid session cookie");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("User not found");

    // lastSignedIn only needs to be roughly right; writing it on every request put a database write behind every API call.
    const now = new Date();
    if (now.getTime() - new Date(user.lastSignedIn).getTime() > 5 * 60_000) {
      await db.upsertUser({ openId: user.openId, lastSignedIn: now });
    }
    return user;
  }
}

export const sdk = new SessionService();
