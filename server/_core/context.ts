import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { HttpError } from "@shared/_core/errors";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures; only auth failures are expected here.
    if (!(error instanceof HttpError)) console.error("[Auth] Unexpected error while authenticating", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
