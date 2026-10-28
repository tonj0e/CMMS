import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  studentId: varchar("studentId", { length: 32 }).unique(),
  admissionNumber: varchar("admissionNumber", { length: 32 }).unique(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // A person who signed up as staff stays a normal (student-level) account until an existing staff member approves the request.
  staffRequestPending: boolean("staffRequestPending").default(false).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const complaints = mysqlTable("complaints", {
  id: int("id").autoincrement().primaryKey(),
  consumerId: varchar("consumerId", { length: 24 }).notNull().unique(),
  studentId: int("studentId").notNull().references(() => users.id),
  category: varchar("category", { length: 64 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location", { length: 180 }).notNull(),
  priority: mysqlEnum("priority", ["Low", "Medium", "High", "Critical"]).default("Medium").notNull(),
  status: mysqlEnum("status", ["Pending", "In Progress", "Resolved", "Withdrawn"]).default("Pending").notNull(),
  isAnonymous: boolean("isAnonymous").default(false).notNull(),
  assignedAdminId: int("assignedAdminId").references(() => users.id),
  resolutionRemarks: text("resolutionRemarks"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
}, (table) => ({
  statusIdx: index("complaints_status_idx").on(table.status),
  categoryIdx: index("complaints_category_idx").on(table.category),
  studentIdx: index("complaints_student_idx").on(table.studentId),
  assignedIdx: index("complaints_assigned_idx").on(table.assignedAdminId),
  updatedIdx: index("complaints_updated_idx").on(table.updatedAt),
}));

export const complaintStatusHistory = mysqlTable("complaint_status_history", {
  id: int("id").autoincrement().primaryKey(),
  complaintId: int("complaintId").notNull().references(() => complaints.id),
  changedByUserId: int("changedByUserId").references(() => users.id),
  oldStatus: varchar("oldStatus", { length: 24 }),
  newStatus: varchar("newStatus", { length: 24 }).notNull(),
  remarks: text("remarks"),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => ({
  complaintIdx: index("history_complaint_idx").on(table.complaintId),
}));

export const complaintAttachments = mysqlTable("complaint_attachments", {
  id: int("id").autoincrement().primaryKey(),
  complaintId: int("complaintId").notNull().references(() => complaints.id),
  uploadedByUserId: int("uploadedByUserId").notNull().references(() => users.id),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 768 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  complaintIdx: index("attachments_complaint_idx").on(table.complaintId),
}));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  complaintId: int("complaintId").references(() => complaints.id),
  type: varchar("type", { length: 40 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("notifications_user_idx").on(table.userId),
  userUnreadIdx: index("notifications_user_unread_idx").on(table.userId, table.isRead),
}));

export const feedback = mysqlTable("feedback", {
  id: int("id").autoincrement().primaryKey(),
  complaintId: int("complaintId").notNull().unique().references(() => complaints.id),
  studentId: int("studentId").notNull().references(() => users.id),
  rating: int("rating").notNull(),
  comments: text("comments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const complaintMessages = mysqlTable("complaint_messages", {
  id: int("id").autoincrement().primaryKey(),
  complaintId: int("complaintId").notNull().references(() => complaints.id),
  senderId: int("senderId").notNull().references(() => users.id),
  // Who wrote it, from the complaint's point of view. The API shows this instead of the sender's identity.
  senderRole: mysqlEnum("senderRole", ["student", "staff"]).notNull(),
  body: text("body").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  complaintIdx: index("messages_complaint_idx").on(table.complaintId, table.createdAt),
  unreadIdx: index("messages_unread_idx").on(table.complaintId, table.senderRole, table.readAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = typeof complaints.$inferInsert;
export type ComplaintStatusHistory = typeof complaintStatusHistory.$inferSelect;
export type ComplaintAttachment = typeof complaintAttachments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type ComplaintMessage = typeof complaintMessages.$inferSelect;
