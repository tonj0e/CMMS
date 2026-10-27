export const CONSUMER_ID_PATTERN = /^CCMS-\d{4}-\d{6}$/;

export function normalizeConsumerId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isConsumerId(value: string) {
  return CONSUMER_ID_PATTERN.test(normalizeConsumerId(value));
}

export type ComplaintStatus = "Pending" | "In Progress" | "Resolved" | "Withdrawn";

/** Allowed status moves. Withdrawn is final; Resolved can only be reopened. Used by the server and to grey out impossible moves in the UI. */
export const STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  Pending: ["In Progress", "Resolved", "Withdrawn"],
  "In Progress": ["Pending", "Resolved", "Withdrawn"],
  Resolved: ["In Progress"],
  Withdrawn: [],
};
