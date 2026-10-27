import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getRecentActivity, changeUserPassword, getBadgeSummary, listUnreadByComplaint, updateUserProfile, getAssistantData, countUnreadMessages, countUnreadNotifications, getStaffStats, listConversations, listMessages, markAllNotificationsRead, markMessagesRead, sendMessage, addComplaintAttachment, addFeedback, assignComplaint, createComplaint, getAdminSummary, getComplaintDetail, getPublicComplaint, getUserByOpenId, listAdminComplaints, listStaff, withdrawComplaint, listNotifications, listStudentComplaints, markNotificationRead, registerUser, updateComplaintStatus, verifyPassword } from "./db";
import { createHash, timingSafeEqual } from "node:crypto";
import { PROFANITY_MESSAGE, findProfanity } from "@shared/profanity";
import { answer as answerAssistant } from "./assistant";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
import { SDKServer, sdk } from "./_core/sdk";

// Letters, digits and - _ / only (e.g. "CS/2021/045"); stored upper-case so lookups and uniqueness are case-insensitive.
const passwordRule = z.string().min(8).max(72).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and number");

/** Constant-time comparison, so the staff access code cannot be guessed from response timing. */
function matchesStaffAccessCode(candidate: string) {
  if (!ENV.staffAccessCode) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(candidate), digest(ENV.staffAccessCode));
}

const idField = (label: string) =>
  z.string().trim().min(3, `${label} must be at least 3 characters`).max(32, `${label} must be at most 32 characters`)
    .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, `${label} can only contain letters, numbers, - _ /`)
    .transform(value => value.toUpperCase());

const complaintInput = z.object({
  category: z.string().min(2).max(64),
  title: z.string().min(3).max(180),
  description: z.string().min(10).max(10000),
  location: z.string().min(2).max(180),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  isAnonymous: z.boolean().default(false),
});


const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

function matchesMimeType(buffer: Buffer, mimeType: string) {
  const magic = MAGIC_BYTES[mimeType];
  return !!magic && magic.every((byte, i) => buffer[i] === byte);
}

/** Never send the password hash (or other server-only columns) to the client. */
function toPublicUser<T extends { passwordHash?: string | null }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => (opts.ctx.user ? toPublicUser(opts.ctx.user) : null)),
    register: publicProcedure
      .input(z.object({
        name: z.string().min(2).max(100),
        studentId: idField("Student ID"),
        admissionNumber: idField("Admission number"),
        email: z.string().email(),
        password: z.string().min(8).max(72).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and number"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { user, openId } = await registerUser({
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            studentId: input.studentId,
            admissionNumber: input.admissionNumber,
            password: input.password,
            role: "user",
          });
          
          const sessionToken = await sdk.createDevSession(openId, user.name ?? "User");
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
          
          return { success: true, user: toPublicUser(user) };
        } catch (error) {
          if (error instanceof Error && /already registered$/.test(error.message)) {
            throw new TRPCError({ code: "CONFLICT", message: error.message });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed" });
        }
      }),
    // Staff create their own account with name, email and password. The staff access code (set by an administrator) is what stops
    // a student from simply registering as staff.
    registerStaff: publicProcedure
      .input(z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: passwordRule,
        accessCode: z.string().trim().min(1, "Enter the staff access code").max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ENV.staffAccessCode) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Staff sign-up is not switched on. Ask an administrator to set it up." });
        }
        if (!matchesStaffAccessCode(input.accessCode)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "That staff access code is not correct" });
        }
        try {
          const { user, openId } = await registerUser({ name: input.name.trim(), email: input.email.trim().toLowerCase(), password: input.password, role: "admin" });
          const sessionToken = await sdk.createDevSession(openId, user.name ?? "Staff");
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: SESSION_MAX_AGE_MS });
          return { success: true, user: toPublicUser(user) };
        } catch (error) {
          if (error instanceof Error && /already registered$/.test(error.message)) throw new TRPCError({ code: "CONFLICT", message: error.message });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed" });
        }
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await verifyPassword({
            email: input.email.trim().toLowerCase(),
            password: input.password,
          });
          
          const sessionToken = await sdk.createDevSession(user.openId, user.name ?? "User");
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
          
          return { success: true, user: toPublicUser(user) };
        } catch (error) {
          if (error instanceof Error && (error.message === "Invalid email or password" || error.message === "Account has no password set")) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password", cause: { field: "email" } });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Login failed" });
        }
      }),
    updateProfile: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email().max(320) }))
      .mutation(async ({ ctx, input }) => toPublicUser(await updateUserProfile(ctx.user.id, input))),
    changePassword: protectedProcedure
      .input(z.object({ currentPassword: z.string().min(1).max(72), newPassword: passwordRule }))
      .mutation(async ({ ctx, input }) => {
        await changeUserPassword(ctx.user.id, input.currentPassword, input.newPassword);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    ...(ENV.devAuthEnabled
      ? {
          devLogin: publicProcedure
            .input(z.object({ role: z.enum(["student", "staff"]) }))
            .mutation(async ({ input, ctx }) => {
              if (!ENV.devAuthEnabled) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Development auth disabled" });
              }
              await sdk.ensureDevUsers();
              const isStudent = input.role === "student";
              const openId = isStudent ? SDKServer.DEV_STUDENT_OPEN_ID : SDKServer.DEV_STAFF_OPEN_ID;
              const name = isStudent ? "Demo Student" : "Demo Staff";
              const sessionToken = await sdk.createDevSession(openId, name);
              const cookieOptions = getSessionCookieOptions(ctx.req);
              ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
              const user = await getUserByOpenId(openId);
              return { success: true, user: user ? toPublicUser(user) : null };
            }),
        }
      : {}),
  }),
  complaints: router({
    track: publicProcedure.input(z.object({ consumerId: z.string().trim().toUpperCase().regex(/^CCMS-\d{4}-\d{6}$/) })).query(({ input }) => getPublicComplaint(input.consumerId)),
    mine: protectedProcedure.query(({ ctx }) => listStudentComplaints(ctx.user.id)),
    detail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const detail = await getComplaintDetail(input.id, ctx.user.id, ctx.user.role === "admin");
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
      return detail;
    }),
    withdraw: protectedProcedure.input(z.object({ complaintId: z.number().int().positive(), remarks: z.string().max(2000).optional() })).mutation(({ ctx, input }) => withdrawComplaint({ ...input, studentId: ctx.user.id })),
    create: protectedProcedure.input(complaintInput).mutation(({ ctx, input }) => {
      // Enforced here as well as in the browser, so the check cannot be bypassed by calling the API directly.
      if (findProfanity(`${input.title}\n${input.description}\n${input.location}`).length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: PROFANITY_MESSAGE });
      }
      return createComplaint({ ...input, studentId: ctx.user.id });
    }),
    feedback: protectedProcedure.input(z.object({ complaintId: z.number().int().positive(), rating: z.number().int().min(1).max(5), comments: z.string().max(2000).optional() })).mutation(({ ctx, input }) => {
      if (input.comments && findProfanity(input.comments).length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: PROFANITY_MESSAGE });
      return addFeedback({ ...input, studentId: ctx.user.id });
    }),
    attachment: protectedProcedure.input(z.object({ complaintId: z.number().int().positive(), fileName: z.string().min(1).max(255), mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]), dataBase64: z.string().min(1).max(14_000_000), sizeBytes: z.number().int().positive().max(10_000_000) })).mutation(async ({ ctx, input }) => {
      const detail = await getComplaintDetail(input.complaintId, ctx.user.id, ctx.user.role === "admin");
      if (!detail) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot attach files to this complaint." });
      if (detail.attachments.length >= 10) throw new TRPCError({ code: "BAD_REQUEST", message: "A complaint can have at most 10 attachments." });
      const buffer = Buffer.from(input.dataBase64, "base64");
      if (buffer.byteLength === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Attachment is empty or not valid base64." });
      if (!matchesMimeType(buffer, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "File contents do not match the declared type." });
      if (buffer.byteLength > 10_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Attachment exceeds 10 MB." });
      const fileKey = `complaints/${input.complaintId}/${ctx.user.id}-${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const uploaded = await storagePut(fileKey, buffer, input.mimeType);
      await addComplaintAttachment({ complaintId: input.complaintId, uploadedByUserId: ctx.user.id, fileKey: uploaded.key, fileUrl: uploaded.url, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: buffer.byteLength });
      return { url: uploaded.url, fileName: input.fileName };
    }),
  }),
  assistant: router({
    ask: protectedProcedure
      .input(z.object({ question: z.string().trim().min(1).max(300), tzOffsetMinutes: z.number().int().min(-840).max(840).default(0) }))
      .mutation(async ({ ctx, input }) => answerAssistant(input.question, await getAssistantData({ id: ctx.user.id, isAdmin: ctx.user.role === "admin" }), input.tzOffsetMinutes)),
  }),
  messages: router({
    list: protectedProcedure.input(z.object({ complaintId: z.number().int().positive() })).query(({ ctx, input }) => listMessages(input.complaintId, { id: ctx.user.id, isAdmin: ctx.user.role === "admin" })),
    send: protectedProcedure.input(z.object({ complaintId: z.number().int().positive(), body: z.string().trim().min(1).max(2000) })).mutation(({ ctx, input }) => {
      if (findProfanity(input.body).length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: PROFANITY_MESSAGE });
      return sendMessage({ complaintId: input.complaintId, body: input.body, viewer: { id: ctx.user.id, isAdmin: ctx.user.role === "admin" } });
    }),
    markRead: protectedProcedure.input(z.object({ complaintId: z.number().int().positive() })).mutation(({ ctx, input }) => markMessagesRead(input.complaintId, { id: ctx.user.id, isAdmin: ctx.user.role === "admin" })),
    unreadCount: protectedProcedure.query(({ ctx }) => countUnreadMessages({ id: ctx.user.id, isAdmin: ctx.user.role === "admin" })),
    unreadByComplaint: protectedProcedure.query(({ ctx }) => listUnreadByComplaint({ id: ctx.user.id, isAdmin: ctx.user.role === "admin" })),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),
    unreadCount: protectedProcedure.query(({ ctx }) => countUnreadNotifications(ctx.user.id)),
    summary: protectedProcedure.query(({ ctx }) => getBadgeSummary({ id: ctx.user.id, isAdmin: ctx.user.role === "admin" })),
    markAllRead: protectedProcedure.mutation(({ ctx }) => markAllNotificationsRead(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => markNotificationRead(input.id, ctx.user.id)),
  }),
  staff: router({
    list: adminProcedure.query(() => listAdminComplaints()),
    updateStatus: adminProcedure.input(z.object({ complaintId: z.number().int().positive(), status: z.enum(["Pending", "In Progress", "Resolved", "Withdrawn"]), remarks: z.string().max(2000).optional() })).mutation(({ ctx, input }) => updateComplaintStatus({ ...input, adminId: ctx.user.id })),
    assign: adminProcedure.input(z.object({ complaintId: z.number().int().positive(), assignedAdminId: z.number().int().positive().nullable() })).mutation(({ ctx, input }) => assignComplaint({ ...input, adminId: ctx.user.id })),
    summary: adminProcedure.input(z.object({ tzOffsetMinutes: z.number().int().min(-840).max(840).default(0) }).default({ tzOffsetMinutes: 0 })).query(({ input }) => getAdminSummary(input.tzOffsetMinutes)),
    listStaff: adminProcedure.query(() => listStaff()),
    conversations: adminProcedure.query(() => listConversations()),
    activity: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(30).default(10) }).default({ limit: 10 })).query(({ input }) => getRecentActivity(input.limit)),
    stats: adminProcedure.input(z.object({ tzOffsetMinutes: z.number().int().min(-840).max(840).default(0) }).default({ tzOffsetMinutes: 0 })).query(({ input }) => getStaffStats(input.tzOffsetMinutes)),
  }),
});

export type AppRouter = typeof appRouter;
