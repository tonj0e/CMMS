import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { randomInt } from "node:crypto";
import { hash, compare as bcryptVerify } from "bcrypt";
import { TRPCError } from "@trpc/server";
import {
  complaintAttachments,
  complaintMessages,
  complaintStatusHistory,
  complaints,
  feedback,
  notifications,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { STATUS_TRANSITIONS, type ComplaintStatus } from "@shared/ccms";
import type { AssistantData } from "./assistant";
import { ENV } from "./_core/env";

function createPool(url: string) {
  const { hostname, searchParams } = new URL(url);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  // Managed MySQL/TiDB requires TLS; honour an explicit ?ssl= in the URL, otherwise enable it for remote hosts.
  const needsTls = !isLocal && !searchParams.has("ssl");
  return mysql.createPool({
    uri: url,
    connectionLimit: 10,
    ...(needsTls ? { ssl: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true } } : {}),
  });
}

const createDb = (url: string) => drizzle(createPool(url));
let _db: ReturnType<typeof createDb> | null = null;

export async function getDb(): Promise<ReturnType<typeof createDb>> {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured. Copy .env.example to .env and set it.");
    }
    try {
      _db = createDb(process.env.DATABASE_URL);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      throw new Error(`Database connection failed: ${String(error)}`);
    }
  }
  return _db;
}

/** Startup check so a bad DATABASE_URL is reported once, clearly, instead of as "Login failed". */
export async function pingDb() {
  const db = await getDb();
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause?.message;
    throw new Error(`Cannot connect to the database. Check DATABASE_URL. ${cause ?? String(error)}`);
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  
  const db = await getDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

function consumerId() {
  const year = new Date().getUTCFullYear();
  // randomInt is uniform; 100000-999999 keeps the CCMS-YYYY-NNNNNN format used by the client and tracker.
  return `CCMS-${year}-${randomInt(100000, 1000000)}`;
}

function isDuplicateKey(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

export async function createComplaint(input: {
  studentId: number;
  category: string;
  title: string;
  description: string;
  location: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  isAnonymous: boolean;
}) {
  const db = await getDb();
  // The id space is small, so retry on a unique-key collision instead of failing the submission.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = consumerId();
    try {
      let internalId = 0;
      await db.transaction(async tx => {
        const [created] = await tx.insert(complaints).values({ ...input, consumerId: id }).$returningId();
        internalId = created.id;
        await tx.insert(complaintStatusHistory).values({ complaintId: internalId, changedByUserId: input.studentId, newStatus: "Pending", remarks: "Complaint submitted" });
        await tx.insert(notifications).values({ userId: input.studentId, complaintId: internalId, type: "submitted", message: `Complaint ${id} was submitted and is pending triage.` });
        // Tell every staff member. The text names the complaint, never the student, so anonymous complaints stay anonymous.
        const staff = await tx.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), ne(users.id, input.studentId)));
        if (staff.length) {
          await tx.insert(notifications).values(staff.map(member => ({
            userId: member.id, complaintId: internalId, type: "new_complaint",
            message: `New ${input.priority} priority complaint ${id}: "${input.title}" (${input.category}, ${input.location}).`,
          })));
        }
      });
      return { consumerId: id, internalId };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate a unique complaint id. Please try again." });
}

export async function listStudentComplaints(studentId: number) {
  const db = await getDb();
  return db.select().from(complaints).where(eq(complaints.studentId, studentId)).orderBy(desc(complaints.updatedAt));
}

export async function getPublicComplaint(consumerId: string) {
  const db = await getDb();
  const result = await db.select({ consumerId: complaints.consumerId, status: complaints.status, updatedAt: complaints.updatedAt, createdAt: complaints.createdAt }).from(complaints).where(eq(complaints.consumerId, consumerId)).limit(1);
  return result[0] ?? null;
}

type Complaint = typeof complaints.$inferSelect;
// Same shape for every viewer: students get their own internal studentId; staff get only studentRef (the real Student ID).
type ComplaintView = Omit<Complaint, "studentId"> & { studentId: number | null; studentRef: string | null };

/** Staff must never learn who filed a complaint beyond the Student ID, and not even that for anonymous ones. */
function toStaffView(complaint: Complaint, studentRef: string | null): ComplaintView {
  const { studentId: _internalId, ...rest } = complaint;
  return { ...rest, studentId: null, studentRef: complaint.isAnonymous ? null : studentRef };
}

export async function getComplaintDetail(id: number, viewerId: number, isAdmin: boolean) {
  const db = await getDb();
  const rows = await db
    .select({ complaint: complaints, studentRef: users.studentId })
    .from(complaints)
    .leftJoin(users, eq(complaints.studentId, users.id))
    .where(isAdmin ? eq(complaints.id, id) : and(eq(complaints.id, id), eq(complaints.studentId, viewerId)))
    .limit(1);
  if (!rows[0]) return null;
  const { complaint, studentRef } = rows[0];
  const [history, attachments] = await Promise.all([
    db.select().from(complaintStatusHistory).where(eq(complaintStatusHistory.complaintId, id)).orderBy(desc(complaintStatusHistory.changedAt), desc(complaintStatusHistory.id)),
    db.select().from(complaintAttachments).where(eq(complaintAttachments.complaintId, id)).orderBy(desc(complaintAttachments.createdAt)),
  ]);
  // Rows written by the student carry the student's internal id; drop it so it neither leaks nor reads as "updated by staff".
  const view: ComplaintView = isAdmin ? toStaffView(complaint, studentRef) : { ...complaint, studentRef: null };
  return {
    complaint: view,
    history: history.map(h => ({ ...h, changedByUserId: h.changedByUserId === complaint.studentId ? null : h.changedByUserId })),
    attachments: attachments.map(a => ({ ...a, uploadedByUserId: isAdmin && a.uploadedByUserId === complaint.studentId ? null : a.uploadedByUserId })),
  };
}

export async function listAdminComplaints() {
  const db = await getDb();
  const rows = await db
    .select({ complaint: complaints, studentRef: users.studentId })
    .from(complaints)
    .leftJoin(users, eq(complaints.studentId, users.id))
    .orderBy(desc(complaints.updatedAt))
    .limit(1000);
  return rows.map(({ complaint, studentRef }) => toStaffView(complaint, studentRef));
}

export async function updateComplaintStatus(input: { complaintId: number; adminId: number; status: ComplaintStatus; remarks?: string }) {
  const db = await getDb();
  await db.transaction(async tx => {
    const current = await tx.select().from(complaints).where(eq(complaints.id, input.complaintId)).limit(1).for("update");
    if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
    const from = current[0].status;
    if (from === input.status) throw new TRPCError({ code: "BAD_REQUEST", message: `Complaint is already ${from}` });
    if (!STATUS_TRANSITIONS[from].includes(input.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot change a ${from} complaint to ${input.status}` });
    }
    await tx.update(complaints).set({
      status: input.status,
      resolutionRemarks: input.remarks ?? current[0].resolutionRemarks,
      resolvedAt: input.status === "Resolved" ? new Date() : null,
    }).where(eq(complaints.id, input.complaintId));
    await tx.insert(complaintStatusHistory).values({ complaintId: input.complaintId, changedByUserId: input.adminId, oldStatus: from, newStatus: input.status, remarks: input.remarks });
    await tx.insert(notifications).values({ userId: current[0].studentId, complaintId: input.complaintId, type: "status_changed", message: `Complaint ${current[0].consumerId} is now ${input.status}.` });
  });
}

export async function withdrawComplaint(input: { complaintId: number; studentId: number; remarks?: string }) {
  const db = await getDb();
  await db.transaction(async tx => {
    const current = await tx.select().from(complaints).where(and(eq(complaints.id, input.complaintId), eq(complaints.studentId, input.studentId))).limit(1).for("update");
    if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
    if (current[0].status !== "Pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending complaints can be withdrawn" });
    await tx.update(complaints).set({ status: "Withdrawn" }).where(eq(complaints.id, input.complaintId));
    await tx.insert(complaintStatusHistory).values({ complaintId: input.complaintId, changedByUserId: input.studentId, oldStatus: "Pending", newStatus: "Withdrawn", remarks: input.remarks ?? "Withdrawn by student" });
    await tx.insert(notifications).values({ userId: input.studentId, complaintId: input.complaintId, type: "status_changed", message: `Complaint ${current[0].consumerId} was withdrawn.` });
  });
}

export async function listStaff() {
  const db = await getDb();
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.role, "admin"));
}

export async function assignComplaint(input: { complaintId: number; adminId: number; assignedAdminId: number | null }) {
  const db = await getDb();
  await db.transaction(async tx => {
    const current = await tx.select().from(complaints).where(eq(complaints.id, input.complaintId)).limit(1).for("update");
    if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
    let assigneeName = "";
    if (input.assignedAdminId !== null) {
      const assignee = await tx.select({ id: users.id, role: users.role, name: users.name }).from(users).where(eq(users.id, input.assignedAdminId)).limit(1);
      if (!assignee[0] || assignee[0].role !== "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee must be a staff member" });
      assigneeName = assignee[0].name ?? `#${assignee[0].id}`;
    }
    await tx.update(complaints).set({ assignedAdminId: input.assignedAdminId }).where(eq(complaints.id, input.complaintId));
    await tx.insert(complaintStatusHistory).values({ complaintId: input.complaintId, changedByUserId: input.adminId, oldStatus: current[0].status, newStatus: current[0].status, remarks: input.assignedAdminId ? `Assigned to ${assigneeName}` : "Assignment cleared" });
    await tx.insert(notifications).values({ userId: current[0].studentId, complaintId: input.complaintId, type: "assigned", message: input.assignedAdminId ? `Complaint ${current[0].consumerId} has been assigned to a staff member.` : `Complaint ${current[0].consumerId} assignment has been cleared.` });
  });
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function countUnreadNotifications(userId: number) {
  const db = await getDb();
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(row?.count ?? 0);
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function addFeedback(input: { complaintId: number; studentId: number; rating: number; comments?: string }) {
  const db = await getDb();
  const owned = await db.select({ id: complaints.id, status: complaints.status }).from(complaints).where(and(eq(complaints.id, input.complaintId), eq(complaints.studentId, input.studentId))).limit(1);
  if (!owned[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
  if (owned[0].status !== "Resolved") throw new TRPCError({ code: "BAD_REQUEST", message: "Feedback is only available for resolved complaints" });
  try {
    await db.insert(feedback).values(input);
  } catch (error) {
    if (isDuplicateKey(error)) throw new TRPCError({ code: "CONFLICT", message: "Feedback was already submitted for this complaint" });
    throw error;
  }
}

export async function getAdminSummary(tzOffsetMinutes = 0) {
  const db = await getDb();
  const dayMs = 86_400_000;
  const offsetMs = tzOffsetMinutes * 60_000;
  const todayStart = Math.floor((Date.now() - offsetMs) / dayMs) * dayMs; // start of the viewer's day, as a UTC-shifted number
  const weekStart = new Date(todayStart - 6 * dayMs + offsetMs);

  const openStatuses = ["Pending", "In Progress"] as const;
  const overdueBefore = new Date(Date.now() - 3 * dayMs);
  const [counts, byCategory, resolution, rating, recent, openByPriority, workload, overdue] = await Promise.all([
    db.select({ status: complaints.status, count: sql<number>`count(*)` }).from(complaints).groupBy(complaints.status),
    db.select({ category: complaints.category, count: sql<number>`count(*)` }).from(complaints).groupBy(complaints.category).orderBy(desc(sql`count(*)`)),
    db.select({
      measured: sql<number>`count(*)`,
      avgMinutes: sql<number>`avg(timestampdiff(minute, ${complaints.createdAt}, ${complaints.resolvedAt}))`,
      within3Days: sql<number>`coalesce(sum(case when timestampdiff(hour, ${complaints.createdAt}, ${complaints.resolvedAt}) <= 72 then 1 else 0 end), 0)`,
    }).from(complaints).where(and(eq(complaints.status, "Resolved"), sql`${complaints.resolvedAt} is not null`)),
    db.select({ avg: sql<number>`avg(${feedback.rating})`, count: sql<number>`count(*)` }).from(feedback),
    db.select({ createdAt: complaints.createdAt }).from(complaints).where(gte(complaints.createdAt, weekStart)),
    db.select({ priority: complaints.priority, count: sql<number>`count(*)` }).from(complaints).where(inArray(complaints.status, [...openStatuses])).groupBy(complaints.priority),
    // Open complaints per staff member (assignedAdminId null = nobody yet).
    db.select({ adminId: complaints.assignedAdminId, name: users.name, email: users.email, count: sql<number>`count(*)` })
      .from(complaints).leftJoin(users, eq(complaints.assignedAdminId, users.id))
      .where(inArray(complaints.status, [...openStatuses])).groupBy(complaints.assignedAdminId, users.name, users.email),
    db.select({ count: sql<number>`count(*)` }).from(complaints).where(and(eq(complaints.status, "Pending"), lt(complaints.createdAt, overdueBefore))),
  ]);

  const perDay = new Map<number, number>();
  for (const { createdAt } of recent) {
    const day = Math.floor((new Date(createdAt).getTime() - offsetMs) / dayMs) * dayMs;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const day = todayStart - (6 - i) * dayMs;
    return { date: new Date(day).toISOString().slice(0, 10), count: perDay.get(day) ?? 0 };
  });

  const map = new Map(counts.map(row => [row.status, Number(row.count)]));
  const measured = Number(resolution[0]?.measured ?? 0);
  return {
    total: Array.from(map.values()).reduce((sum, count) => sum + count, 0),
    pending: map.get("Pending") ?? 0,
    inProgress: map.get("In Progress") ?? 0,
    resolved: map.get("Resolved") ?? 0,
    withdrawn: map.get("Withdrawn") ?? 0,
    byCategory: byCategory.map(row => ({ category: row.category, count: Number(row.count) })),
    // Real measurements. Null / 0 means "no data yet", never a made-up default.
    avgResolutionHours: measured > 0 ? Number(resolution[0].avgMinutes) / 60 : null,
    resolvedMeasured: measured,
    resolvedWithin3Days: Number(resolution[0]?.within3Days ?? 0),
    avgRating: Number(rating[0]?.count ?? 0) > 0 ? Number(rating[0].avg) : null,
    feedbackCount: Number(rating[0]?.count ?? 0),
    last7Days,
    openByPriority: { Critical: 0, High: 0, Medium: 0, Low: 0, ...Object.fromEntries(openByPriority.map(r => [r.priority, Number(r.count)])) } as Record<"Critical" | "High" | "Medium" | "Low", number>,
    overduePending: Number(overdue[0]?.count ?? 0),
    unassignedOpen: workload.filter(w => w.adminId === null).reduce((sum, w) => sum + Number(w.count), 0),
    workload: workload.filter(w => w.adminId !== null).map(w => ({ adminId: w.adminId as number, name: w.name ?? w.email ?? `Staff #${w.adminId}`, count: Number(w.count) })).sort((a, b) => b.count - a.count).slice(0, 8),
  };
}

/** Latest changes across all complaints, for the staff dashboard feed. Staff are named; students are only "Student" (anonymity). */
export async function getRecentActivity(limit = 10) {
  const db = await getDb();
  const rows = await db.select({
    id: complaintStatusHistory.id, complaintId: complaintStatusHistory.complaintId, consumerId: complaints.consumerId, title: complaints.title,
    oldStatus: complaintStatusHistory.oldStatus, newStatus: complaintStatusHistory.newStatus, remarks: complaintStatusHistory.remarks,
    changedAt: complaintStatusHistory.changedAt, changedBy: complaintStatusHistory.changedByUserId, actorRole: users.role, actorName: users.name, studentId: complaints.studentId,
  })
    .from(complaintStatusHistory)
    .innerJoin(complaints, eq(complaintStatusHistory.complaintId, complaints.id))
    .leftJoin(users, eq(complaintStatusHistory.changedByUserId, users.id))
    .orderBy(desc(complaintStatusHistory.changedAt), desc(complaintStatusHistory.id))
    .limit(Math.min(Math.max(limit, 1), 30));
  return rows.map(r => ({
    id: r.id, complaintId: r.complaintId, consumerId: r.consumerId, title: r.title, oldStatus: r.oldStatus, newStatus: r.newStatus,
    remarks: r.remarks, changedAt: r.changedAt,
    // A change by the complaint's own student, or by nobody (initial submission), is shown as "Student".
    actor: r.changedBy && r.changedBy !== r.studentId && r.actorRole === "admin" ? (r.actorName ?? "Staff") : "Student",
  }));
}

export async function addComplaintAttachment(input: {
  complaintId: number;
  uploadedByUserId: number;
  fileKey: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const db = await getDb();
  await db.insert(complaintAttachments).values(input);
}

export async function registerUser(input: {
  email: string;
  name: string;
  studentId?: string;
  admissionNumber?: string;
  password: string;
  role: "user" | "admin";
}) {
  const db = await getDb();
  
  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing[0]) {
    throw new Error("Email already registered");
  }
  if (input.studentId) {
    const dup = await db.select({ id: users.id }).from(users).where(eq(users.studentId, input.studentId)).limit(1);
    if (dup[0]) throw new Error("Student ID already registered");
  }
  if (input.admissionNumber) {
    const dup = await db.select({ id: users.id }).from(users).where(eq(users.admissionNumber, input.admissionNumber)).limit(1);
    if (dup[0]) throw new Error("Admission number already registered");
  }
  
  // Hash password
  const passwordHash = await hash(input.password, 12);
  
  const now = new Date();
  const openId = `local_${crypto.randomUUID()}`;
  
  try {
    await db.insert(users).values({
      openId,
      name: input.name,
      email: input.email,
      studentId: input.studentId ?? null,
      admissionNumber: input.admissionNumber ?? null,
      loginMethod: "local",
      role: input.role,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    });
  } catch (error) {
    // Two concurrent registrations can both pass the check above; the unique index decides.
    if (isDuplicateKey(error)) {
      const detail = String((error as { cause?: { message?: string }; message?: string }).cause?.message ?? (error as Error).message);
      if (detail.includes("studentId")) throw new Error("Student ID already registered");
      if (detail.includes("admissionNumber")) throw new Error("Admission number already registered");
      throw new Error("Email already registered");
    }
    throw error;
  }
  
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Failed to create user");
  
  return { user, openId };
}

// Compared against when the email is unknown so both failure paths cost the same (prevents email enumeration by timing).
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(input: { email: string; password: string }) {
  const db = await getDb();
  const user = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  
  if (!user[0]) {
    dummyHash ??= hash("not-a-real-password", 12);
    await bcryptVerify(input.password, await dummyHash);
    throw new Error("Invalid email or password");
  }
  
  if (!user[0].passwordHash) {
    throw new Error("Account has no password set");
  }
  
  const isValid = await bcryptVerify(input.password, user[0].passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }
  
  return user[0];
}


// ---------------------------------------------------------------- messages (student <-> staff chat on a complaint)

type Viewer = { id: number; isAdmin: boolean };

/** Students may only reach their own complaints; staff may reach any. Returns the complaint or throws NOT_FOUND. */
async function complaintForViewer(complaintId: number, viewer: Viewer) {
  const db = await getDb();
  const rows = await db.select().from(complaints)
    .where(viewer.isAdmin ? eq(complaints.id, complaintId) : and(eq(complaints.id, complaintId), eq(complaints.studentId, viewer.id)))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
  return rows[0];
}

const roleOf = (viewer: Viewer) => (viewer.isAdmin ? "staff" : "student") as "staff" | "student";

export async function listMessages(complaintId: number, viewer: Viewer) {
  await complaintForViewer(complaintId, viewer);
  const db = await getDb();
  const rows = await db.select().from(complaintMessages).where(eq(complaintMessages.complaintId, complaintId)).orderBy(complaintMessages.createdAt, complaintMessages.id);
  // senderId is deliberately not returned: anonymous students must not be identifiable through the chat.
  return rows.map(m => ({ id: m.id, from: m.senderRole, mine: m.senderRole === roleOf(viewer), body: m.body, createdAt: m.createdAt, readAt: m.readAt }));
}

export async function sendMessage(input: { complaintId: number; viewer: Viewer; body: string }) {
  const complaint = await complaintForViewer(input.complaintId, input.viewer);
  if (complaint.status === "Withdrawn") throw new TRPCError({ code: "BAD_REQUEST", message: "This complaint was withdrawn, so the conversation is closed." });
  const db = await getDb();
  const role = roleOf(input.viewer);
  const preview = input.body.length > 90 ? `${input.body.slice(0, 90)}…` : input.body;
  let messageId = 0;
  await db.transaction(async tx => {
    const [created] = await tx.insert(complaintMessages).values({ complaintId: complaint.id, senderId: input.viewer.id, senderRole: role, body: input.body }).$returningId();
    messageId = created.id;
    if (role === "staff") {
      await tx.insert(notifications).values({ userId: complaint.studentId, complaintId: complaint.id, type: "message", message: `Staff replied on ${complaint.consumerId}: "${preview}"` });
    } else {
      const recipients = complaint.assignedAdminId
        ? [{ id: complaint.assignedAdminId }]
        : await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      if (recipients.length) {
        await tx.insert(notifications).values(recipients.map(r => ({ userId: r.id, complaintId: complaint.id, type: "message", message: `New message on ${complaint.consumerId}: "${preview}"` })));
      }
    }
  });
  return { id: messageId };
}

/** Marks the other side's messages as read (and the matching notifications) once a viewer has opened the conversation. */
export async function markMessagesRead(complaintId: number, viewer: Viewer) {
  await complaintForViewer(complaintId, viewer);
  const db = await getDb();
  const otherRole = roleOf(viewer) === "staff" ? "student" : "staff";
  await db.update(complaintMessages).set({ readAt: new Date() })
    .where(and(eq(complaintMessages.complaintId, complaintId), eq(complaintMessages.senderRole, otherRole), isNull(complaintMessages.readAt)));
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, viewer.id), eq(notifications.complaintId, complaintId), eq(notifications.type, "message"), eq(notifications.isRead, false)));
}

/** Unread messages waiting for this viewer: staff count student messages, students count staff replies on their own complaints. */
export async function countUnreadMessages(viewer: Viewer) {
  const db = await getDb();
  const otherRole = roleOf(viewer) === "staff" ? "student" : "staff";
  const [row] = await db.select({ count: sql<number>`count(*)` })
    .from(complaintMessages)
    .innerJoin(complaints, eq(complaintMessages.complaintId, complaints.id))
    .where(and(
      eq(complaintMessages.senderRole, otherRole),
      isNull(complaintMessages.readAt),
      viewer.isAdmin ? undefined : eq(complaints.studentId, viewer.id),
    ));
  return Number(row?.count ?? 0);
}

/** Staff chat inbox: every complaint (staff view, so no student identity) with its latest message and unread count. */
export async function listConversations() {
  const db = await getDb();
  const [complaintRows, aggregates, lastMessages] = await Promise.all([
    db.select({ complaint: complaints, studentRef: users.studentId }).from(complaints).leftJoin(users, eq(complaints.studentId, users.id)).orderBy(desc(complaints.updatedAt)).limit(1000),
    db.select({
      complaintId: complaintMessages.complaintId,
      total: sql<number>`count(*)`,
      unread: sql<number>`sum(case when ${complaintMessages.senderRole} = 'student' and ${complaintMessages.readAt} is null then 1 else 0 end)`,
    }).from(complaintMessages).groupBy(complaintMessages.complaintId),
    db.select().from(complaintMessages).where(inArray(complaintMessages.id, db.select({ id: sql<number>`max(${complaintMessages.id})` }).from(complaintMessages).groupBy(complaintMessages.complaintId))),
  ]);
  const stats = new Map(aggregates.map(a => [a.complaintId, { total: Number(a.total), unread: Number(a.unread ?? 0) }]));
  const last = new Map(lastMessages.map(m => [m.complaintId, m]));
  const rows = complaintRows.map(({ complaint, studentRef }) => {
    const message = last.get(complaint.id);
    const stat = stats.get(complaint.id);
    return {
      ...toStaffView(complaint, studentRef),
      messageCount: stat?.total ?? 0,
      unreadMessages: stat?.unread ?? 0,
      lastMessage: message ? { body: message.body, from: message.senderRole, createdAt: message.createdAt } : null,
    };
  });
  // Unread first, then most recent activity (last message or last update).
  const activity = (r: (typeof rows)[number]) => new Date(r.lastMessage?.createdAt ?? r.updatedAt).getTime();
  return rows.sort((a, b) => (b.unreadMessages > 0 ? 1 : 0) - (a.unreadMessages > 0 ? 1 : 0) || activity(b) - activity(a));
}

/** Headline numbers for the staff chat page. `tzOffsetMinutes` is the browser's Date#getTimezoneOffset(), so "today" means the staff member's day. */
export async function getStaffStats(tzOffsetMinutes = 0) {
  const db = await getDb();
  const offsetMs = tzOffsetMinutes * 60_000;
  const localNow = Date.now() - offsetMs;
  const dayMs = 86_400_000;
  const todayStart = new Date(Math.floor(localNow / dayMs) * dayMs + offsetMs);
  const yesterdayStart = new Date(todayStart.getTime() - dayMs);
  const tomorrowStart = new Date(todayStart.getTime() + dayMs);
  const countIn = async (from: Date, to: Date) => {
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(complaints).where(and(gte(complaints.createdAt, from), lt(complaints.createdAt, to)));
    return Number(row?.count ?? 0);
  };
  const [today, yesterday, byStatus] = await Promise.all([
    countIn(todayStart, tomorrowStart),
    countIn(yesterdayStart, todayStart),
    db.select({ status: complaints.status, count: sql<number>`count(*)` }).from(complaints).groupBy(complaints.status),
  ]);
  const status = new Map(byStatus.map(r => [r.status, Number(r.count)]));
  return {
    today,
    yesterday,
    pending: status.get("Pending") ?? 0,
    inProgress: status.get("In Progress") ?? 0,
    resolved: status.get("Resolved") ?? 0,
    total: Array.from(status.values()).reduce((a, b) => a + b, 0),
  };
}


/** Everything the complaint assistant needs to answer a question. Staff see all complaints, students only their own. */
export async function getAssistantData(viewer: Viewer): Promise<AssistantData> {
  const db = await getDb();
  const role = roleOf(viewer);
  const otherRole = role === "staff" ? "student" : "staff";
  const since = new Date(Date.now() - 31 * 86_400_000);
  const scope = viewer.isAdmin ? undefined : eq(complaints.studentId, viewer.id);

  const [rows, changes, unread, studentMessages] = await Promise.all([
    db.select({
      id: complaints.id, consumerId: complaints.consumerId, title: complaints.title, status: complaints.status, priority: complaints.priority,
      category: complaints.category, createdAt: complaints.createdAt, updatedAt: complaints.updatedAt, assignedAdminId: complaints.assignedAdminId,
    }).from(complaints).where(scope).orderBy(desc(complaints.createdAt)).limit(20_000),
    db.select({ complaintId: complaintStatusHistory.complaintId, at: complaintStatusHistory.changedAt })
      .from(complaintStatusHistory)
      .innerJoin(complaints, eq(complaintStatusHistory.complaintId, complaints.id))
      .where(and(sql`${complaintStatusHistory.oldStatus} is not null`, gte(complaintStatusHistory.changedAt, since), scope)),
    db.select({ complaintId: complaintMessages.complaintId, count: sql<number>`count(*)` })
      .from(complaintMessages)
      .innerJoin(complaints, eq(complaintMessages.complaintId, complaints.id))
      .where(and(eq(complaintMessages.senderRole, otherRole), isNull(complaintMessages.readAt), scope))
      .groupBy(complaintMessages.complaintId),
    viewer.isAdmin
      ? db.select({ at: complaintMessages.createdAt }).from(complaintMessages).where(and(eq(complaintMessages.senderRole, "student"), gte(complaintMessages.createdAt, since)))
      : Promise.resolve([] as { at: Date }[]),
  ]);

  return {
    role,
    complaints: rows,
    changes,
    unreadByComplaint: new Map(unread.map(u => [u.complaintId, Number(u.count)])),
    studentMessageTimes: studentMessages.map(m => m.at),
  };
}


// ---------------------------------------------------------------- account

export async function updateUserProfile(userId: number, input: { name: string; email: string }) {
  const db = await getDb();
  try {
    await db.update(users).set({ name: input.name, email: input.email }).where(eq(users.id, userId));
  } catch (error) {
    if (isDuplicateKey(error)) throw new TRPCError({ code: "CONFLICT", message: "That email is already used by another account" });
    throw error;
  }
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

export async function changeUserPassword(userId: number, currentPassword: string, newPassword: string) {
  const db = await getDb();
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row?.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "This account signs in without a password, so there is none to change." });
  if (!(await bcryptVerify(currentPassword, row.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your current password is not correct" });
  if (await bcryptVerify(newPassword, row.passwordHash)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a password that is different from the current one" });
  await db.update(users).set({ passwordHash: await hash(newPassword, 12) }).where(eq(users.id, userId));
}

// ---------------------------------------------------------------- badges

/** One cheap call that drives the sidebar/bell badges and the pop-up toast, instead of several polled queries. */
export async function getBadgeSummary(viewer: Viewer) {
  const db = await getDb();
  const [unreadNotifications, unreadMessages, latest] = await Promise.all([
    countUnreadNotifications(viewer.id),
    countUnreadMessages(viewer),
    db.select({ id: notifications.id, type: notifications.type, message: notifications.message, complaintId: notifications.complaintId })
      .from(notifications).where(and(eq(notifications.userId, viewer.id), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.id)).limit(1),
  ]);
  return { unreadNotifications, unreadMessages, latest: latest[0] ?? null };
}

/** Which complaints have messages waiting for this viewer, and how many. */
export async function listUnreadByComplaint(viewer: Viewer) {
  const db = await getDb();
  const otherRole = roleOf(viewer) === "staff" ? "student" : "staff";
  const rows = await db.select({ complaintId: complaintMessages.complaintId, count: sql<number>`count(*)`, lastAt: sql<Date>`max(${complaintMessages.createdAt})` })
    .from(complaintMessages)
    .innerJoin(complaints, eq(complaintMessages.complaintId, complaints.id))
    .where(and(eq(complaintMessages.senderRole, otherRole), isNull(complaintMessages.readAt), viewer.isAdmin ? undefined : eq(complaints.studentId, viewer.id)))
    .groupBy(complaintMessages.complaintId)
    .orderBy(desc(sql`max(${complaintMessages.createdAt})`));
  return rows.map(r => ({ complaintId: r.complaintId, count: Number(r.count) }));
}
