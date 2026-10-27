import { describe, expect, it } from "vitest";
import { STATUS_TRANSITIONS, isConsumerId, normalizeConsumerId } from "./ccms";

describe("CCMS Consumer IDs", () => {
  it("normalizes whitespace and casing", () => {
    expect(normalizeConsumerId(" ccms-2026-000482 ")).toBe("CCMS-2026-000482");
  });

  it("accepts the public tracking format", () => {
    expect(isConsumerId("CCMS-2026-000482")).toBe(true);
    expect(isConsumerId("CCMS-26-482")).toBe(false);
  });
});

describe("complaint status transitions", () => {
  it("Withdrawn is final and Resolved can only be reopened", () => {
    expect(STATUS_TRANSITIONS.Withdrawn).toEqual([]);
    expect(STATUS_TRANSITIONS.Resolved).toEqual(["In Progress"]);
  });

  it("no status can move to itself", () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) expect(targets).not.toContain(from);
  });
});
