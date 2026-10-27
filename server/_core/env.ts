export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Secret that lets a new staff member create their own account. Empty = staff sign-up is switched off.
  staffAccessCode: process.env.STAFF_ACCESS_CODE ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Passwordless demo logins: explicit opt-in AND NODE_ENV=development, never implied by a missing NODE_ENV.
  devAuthEnabled: process.env.NODE_ENV === "development" && process.env.DEV_AUTH_ENABLED === "true",
};

/** Fail fast at startup instead of returning opaque 500s on the first login. */
export function assertServerEnv() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Copy .env.example to .env and fill them in.`
    );
  }
  if ((process.env.JWT_SECRET as string).length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
  if (process.env.STAFF_ACCESS_CODE && process.env.STAFF_ACCESS_CODE.length < 8) {
    throw new Error("STAFF_ACCESS_CODE must be at least 8 characters long (or leave it empty to disable staff sign-up).");
  }
  if (ENV.devAuthEnabled) {
    const host = new URL(process.env.DATABASE_URL as string).hostname;
    if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
      throw new Error("DEV_AUTH_ENABLED creates passwordless admin logins and must not be used with a remote DATABASE_URL.");
    }
  }
}
