import { describe, expect, it } from "vitest";
import { answer, interpret, type AssistantData, type AssistantRow } from "./assistant";

const now = new Date("2026-10-27T12:00:00Z");
const at = (iso: string) => new Date(iso);
const row = (id: number, created: string, status: AssistantRow["status"], priority: AssistantRow["priority"], extra: Partial<AssistantRow> = {}): AssistantRow => ({
  id, consumerId: `CCMS-2026-00000${id}`, title: `Complaint ${id}`, status, priority, category: "Hostel",
  createdAt: at(created), updatedAt: at(created), assignedAdminId: null, ...extra,
});

const complaints = [
  row(1, "2026-10-27T10:00:00Z", "Pending", "High"),
  row(2, "2026-10-27T09:00:00Z", "Pending", "Low"),
  row(3, "2026-10-27T08:00:00Z", "In Progress", "Critical", { category: "Classroom" }),
  row(4, "2026-10-26T15:00:00Z", "Resolved", "Medium"),
  row(5, "2026-10-26T10:00:00Z", "Pending", "High"),
  row(6, "2026-10-22T10:00:00Z", "Withdrawn", "Low", { assignedAdminId: 1 }),
];
const data = (role: "staff" | "student" = "staff"): AssistantData => ({
  role,
  complaints,
  changes: [
    { complaintId: 3, at: at("2026-10-27T11:00:00Z") },
    { complaintId: 4, at: at("2026-10-27T11:30:00Z") },
    { complaintId: 5, at: at("2026-10-26T11:00:00Z") },
  ],
  unreadByComplaint: new Map([[1, 2]]),
  studentMessageTimes: [at("2026-10-27T10:30:00Z"), at("2026-10-27T11:00:00Z"), at("2026-10-26T09:00:00Z")],
});
const ask = (q: string, role: "staff" | "student" = "staff") => answer(q, data(role), 0, now);

describe("assistant: understanding the question", () => {
  it("reads time, status, severity and the 'updated' field", () => {
    expect(interpret("how many serious pending complaints came yesterday")).toMatchObject({ window: "yesterday", status: "Pending", severity: "serious" });
    expect(interpret("complaints updated today")).toMatchObject({ window: "today", field: "updated" });
  });

  it("does not confuse 'not serious' with 'serious'", () => {
    expect(interpret("how many not serious complaints").severity).toBe("minor");
    expect(interpret("show minor complaints").severity).toBe("minor");
    expect(interpret("serious complaints").severity).toBe("serious");
    expect(interpret("critical ones").severity).toBe("critical");
  });
});

describe("assistant: counts are exact", () => {
  it("today / yesterday", () => {
    expect(ask("How many complaints came today?").text).toBe("There are 3 complaints filed today.");
    expect(ask("how many complaints came yesterday").text).toBe("There are 2 complaints filed yesterday.");
  });

  it("pending / in progress / resolved (right now, not just today)", () => {
    expect(ask("How many are pending?").text).toBe("There are 3 pending complaints.");
    expect(ask("how many in progress").text).toBe("There is 1 in-progress complaint.");
    expect(ask("how many resolved").text).toContain("1 resolved complaint");
  });

  it("serious and not serious, alone and combined", () => {
    expect(ask("how many serious complaints today").text).toContain("There are 2 serious complaints filed today.");
    expect(ask("serious pending complaints today").text).toContain("There is 1 serious pending complaint filed today.");
    expect(ask("how many not serious complaints today").text).toContain("There is 1 not serious complaint filed today.");
    expect(ask("critical complaints").text).toContain("1 critical complaint");
  });

  it("'open' means pending or in progress", () => {
    expect(ask("How many serious complaints are open?").text).toContain("There are 3 serious open complaints.");
    expect(ask("how many complaints are still unresolved").text).toContain("4 open complaints");
  });

  it("updated today / yesterday", () => {
    expect(ask("which complaints were updated today").text).toContain("There are 2 complaints updated today.");
    expect(ask("how many updated yesterday").text).toContain("1 complaint updated yesterday");
  });

  it("filters by category", () => {
    expect(ask("how many classroom complaints").text).toContain("1 complaint in Classroom");
  });

  it("lists the matching complaints, most serious first", () => {
    const a = ask("complaints today");
    expect(a.complaints?.map(c => c.id)).toEqual([3, 1, 2]); // Critical, High, Low
  });

  it("says so when nothing matches", () => {
    expect(ask("how many withdrawn complaints today").text).toMatch(/^No withdrawn complaints filed today\./);
  });
});

describe("assistant: other questions", () => {
  it("unread messages, new messages today, unassigned, oldest", () => {
    expect(ask("how many unread messages").text).toContain("2 unread messages from students across 1 complaint");
    expect(ask("new messages today").text).toContain("2 messages from students today");
    expect(ask("unassigned complaints").text).toContain("4 open complaints have no staff member assigned");
    expect(ask("which pending complaint is the oldest").text).toContain("filed 1 day ago");
  });

  it("summary returns the headline numbers", () => {
    const stats = Object.fromEntries((ask("give me a summary").stats ?? []).map(s => [s.label, s.value]));
    expect(stats).toMatchObject({ "Filed today": 3, "Filed yesterday": 2, "Updated today": 2, Pending: 3, "In progress": 1, Resolved: 1, "Serious (open)": 3, "Not serious (open)": 1, "Unread messages": 2 });
  });

  it("small talk and help never fail", () => {
    expect(ask("hi").text).toMatch(/^Hi!/);
    expect(ask("thank you").text).toMatch(/welcome/i);
    expect(ask("what can you do").text).toContain("How many complaints came today");
    expect(ask("asdf qwerty").text).toBeTruthy();
  });
});

describe("assistant: student view", () => {
  it("speaks to the student about their own complaints", () => {
    expect(ask("how many are pending", "student").text).toBe("You have 3 pending complaints.");
    expect(ask("what is the status of my latest complaint", "student").text).toContain("Your latest complaint CCMS-2026-000001");
    expect(ask("do i have new replies", "student").text).toContain("2 new replies");
  });

  it("explains how to track, submit and withdraw", () => {
    expect(ask("how do i track my complaint", "student").text).toContain("Track complaint");
    expect(ask("how can i submit a complaint", "student").text).toContain("Submit complaint");
    expect(ask("how do I withdraw", "student").text).toContain("Withdraw");
  });
});
