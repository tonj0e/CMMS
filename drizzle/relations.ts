import { relations } from "drizzle-orm";
import {
  users,
  complaints,
  complaintStatusHistory,
  complaintAttachments,
  notifications,
  feedback,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  complaints: many(complaints, { relationName: "studentComplaints" }),
  assignedComplaints: many(complaints, { relationName: "assignedComplaints" }),
  statusChanges: many(complaintStatusHistory),
  attachments: many(complaintAttachments),
  notifications: many(notifications),
  feedback: many(feedback),
}));

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  student: one(users, {
    fields: [complaints.studentId],
    references: [users.id],
    relationName: "studentComplaints",
  }),
  assignedAdmin: one(users, {
    fields: [complaints.assignedAdminId],
    references: [users.id],
    relationName: "assignedComplaints",
  }),
  statusHistory: many(complaintStatusHistory),
  attachments: many(complaintAttachments),
  notifications: many(notifications),
  feedback: one(feedback),
}));

export const complaintStatusHistoryRelations = relations(
  complaintStatusHistory,
  ({ one }) => ({
    complaint: one(complaints, {
      fields: [complaintStatusHistory.complaintId],
      references: [complaints.id],
    }),
    changedBy: one(users, {
      fields: [complaintStatusHistory.changedByUserId],
      references: [users.id],
    }),
  })
);

export const complaintAttachmentsRelations = relations(
  complaintAttachments,
  ({ one }) => ({
    complaint: one(complaints, {
      fields: [complaintAttachments.complaintId],
      references: [complaints.id],
    }),
    uploadedBy: one(users, {
      fields: [complaintAttachments.uploadedByUserId],
      references: [users.id],
    }),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  complaint: one(complaints, {
    fields: [notifications.complaintId],
    references: [complaints.id],
  }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  complaint: one(complaints, {
    fields: [feedback.complaintId],
    references: [complaints.id],
  }),
  student: one(users, {
    fields: [feedback.studentId],
    references: [users.id],
  }),
}));