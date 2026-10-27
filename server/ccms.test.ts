import { describe, expect, it } from "vitest";
import { isConsumerId, normalizeConsumerId } from "../shared/ccms";

describe("CCMS Consumer IDs", () => {
  it("normalizes whitespace and casing", () => {
    expect(normalizeConsumerId(" ccms-2026-000482 ")).toBe("CCMS-2026-000482");
  });

  it("accepts the public tracking format", () => {
    expect(isConsumerId("CCMS-2026-000482")).toBe(true);
    expect(isConsumerId("CCMS-26-482")).toBe(false);
  });
});
