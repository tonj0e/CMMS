ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `complaints_assigned_idx` ON `complaints` (`assignedAdminId`);--> statement-breakpoint
CREATE INDEX `complaints_updated_idx` ON `complaints` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `notifications_user_unread_idx` ON `notifications` (`userId`,`isRead`);