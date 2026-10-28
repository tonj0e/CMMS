import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("CCMS complaint access boundaries", () => {
  it("requires authentication to create a complaint", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.complaints.create({
      category: "Infrastructure",
      title: "Broken light",
      description: "The corridor light is not working after 8pm.",
      location: "Block A",
      priority: "Medium",
      isAnonymous: false,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires an admin role for staff queues", async () => {
    const caller = appRouter.createCaller(context({
      id: 2,
      openId: "student-user",
      name: "Student User",
      email: "student@example.com",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));
    await expect(caller.staff.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects malformed public tracking identifiers", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.complaints.track({ consumerId: "CCMS-26-482" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
