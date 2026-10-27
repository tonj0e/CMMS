CREATE TABLE `complaint_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`complaintId` int NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(768) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sizeBytes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `complaint_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `complaint_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`complaintId` int NOT NULL,
	`changedByUserId` int,
	`oldStatus` varchar(24),
	`newStatus` varchar(24) NOT NULL,
	`remarks` text,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `complaint_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consumerId` varchar(24) NOT NULL,
	`studentId` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`location` varchar(180) NOT NULL,
	`priority` enum('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
	`status` enum('Pending','In Progress','Resolved','Withdrawn') NOT NULL DEFAULT 'Pending',
	`isAnonymous` boolean NOT NULL DEFAULT false,
	`assignedAdminId` int,
	`resolutionRemarks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`resolvedAt` timestamp,
	CONSTRAINT `complaints_id` PRIMARY KEY(`id`),
	CONSTRAINT `complaints_consumerId_unique` UNIQUE(`consumerId`)
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`complaintId` int NOT NULL,
	`studentId` int NOT NULL,
	`rating` int NOT NULL,
	`comments` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `feedback_complaintId_unique` UNIQUE(`complaintId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`complaintId` int,
	`type` varchar(40) NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `complaint_attachments` ADD CONSTRAINT `complaint_attachments_complaintId_complaints_id_fk` FOREIGN KEY (`complaintId`) REFERENCES `complaints`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complaint_attachments` ADD CONSTRAINT `complaint_attachments_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complaint_status_history` ADD CONSTRAINT `complaint_status_history_complaintId_complaints_id_fk` FOREIGN KEY (`complaintId`) REFERENCES `complaints`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complaint_status_history` ADD CONSTRAINT `complaint_status_history_changedByUserId_users_id_fk` FOREIGN KEY (`changedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complaints` ADD CONSTRAINT `complaints_studentId_users_id_fk` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complaints` ADD CONSTRAINT `complaints_assignedAdminId_users_id_fk` FOREIGN KEY (`assignedAdminId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_complaintId_complaints_id_fk` FOREIGN KEY (`complaintId`) REFERENCES `complaints`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_studentId_users_id_fk` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_complaintId_complaints_id_fk` FOREIGN KEY (`complaintId`) REFERENCES `complaints`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attachments_complaint_idx` ON `complaint_attachments` (`complaintId`);--> statement-breakpoint
CREATE INDEX `history_complaint_idx` ON `complaint_status_history` (`complaintId`);--> statement-breakpoint
CREATE INDEX `complaints_status_idx` ON `complaints` (`status`);--> statement-breakpoint
CREATE INDEX `complaints_category_idx` ON `complaints` (`category`);--> statement-breakpoint
CREATE INDEX `complaints_student_idx` ON `complaints` (`studentId`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`userId`);