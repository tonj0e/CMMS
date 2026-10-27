import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const student = {
  id: 7, openId: "local_x", name: "S", email: "s@example.com", loginMethod: "local",
  role: "user" as const, passwordHash: "$2b$12$secret", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
};

describe("security", () => {
  it("auth.me never returns the password hash", async () => {
    const me = await appRouter.createCaller(ctxFor(student)).auth.me();
    expect(me).not.toBeNull();
    expect(me).not.toHaveProperty("passwordHash");
  });

  it("students cannot call staff procedures", async () => {
    const caller = appRouter.createCaller(ctxFor(student));
    await expect(caller.staff.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.staff.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("anonymous users cannot read protected data", async () => {
    await expect(appRouter.createCaller(ctxFor(null)).complaints.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects passwords over 72 bytes", async () => {
    const long = "Aa1" + "x".repeat(80);
    await expect(
      appRouter.createCaller(ctxFor(null)).auth.register({ name: "Long", email: "l@example.com", password: long })
    ).rejects.toThrow(/too_big|72/);
  });

  it("chat, stats and conversations are closed to the wrong people", async () => {
    const anon = appRouter.createCaller(ctxFor(null));
    await expect(anon.messages.list({ complaintId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.messages.send({ complaintId: 1, body: "hi" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const asStudent = appRouter.createCaller(ctxFor(student));
    await expect(asStudent.staff.conversations()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(asStudent.staff.stats({ tzOffsetMinutes: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("abusive chat messages are rejected before they reach the database", async () => {
    await expect(appRouter.createCaller(ctxFor(student)).messages.send({ complaintId: 1, body: "you are an idiot" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("staff sign-up is refused unless an administrator has set a staff access code", async () => {
    // No STAFF_ACCESS_CODE exists in the unit-test environment, so nobody can register as staff, whatever code they type.
    await expect(
      appRouter.createCaller(ctxFor(null)).auth.registerStaff({ name: "Intruder", email: "intruder@example.com", password: "Passw0rdX", accessCode: "anything" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
