import type { Express } from "express";
import { getComplaintDetail } from "../db";
import { localPathForKey } from "../storage";
import { sdk } from "./sdk";

// Keys look like complaints/<complaintId>/<file>; only the complaint's owner or staff may fetch them.
async function canAccess(req: Parameters<typeof sdk.authenticateRequest>[0], key: string) {
  const match = /^complaints\/(\d+)\//.exec(key);
  if (!match) return false;
  try {
    const user = await sdk.authenticateRequest(req);
    return !!(await getComplaintDetail(Number(match[1]), user.id, user.role === "admin"));
  } catch {
    return false;
  }
}

export function registerStorageProxy(app: Express) {
  app.get("/files/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key || key.includes("..")) {
      res.status(400).send("Invalid storage key");
      return;
    }
    if (!(await canAccess(req, key))) {
      res.status(403).send("Forbidden");
      return;
    }
    const file = localPathForKey(key);
    if (!file) {
      res.status(400).send("Invalid storage key");
      return;
    }
    res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    res.sendFile(file, error => {
      if (error && !res.headersSent) res.status(404).send("Not found");
    });
  });
}
