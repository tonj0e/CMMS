CREATE TABLE `complaint_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`complaintId` int NOT NULL,
	`senderId` int NOT NULL,
	`senderRole` enum('student','staff') NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `complaint_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `complaint_messages` ADD CONSTRAINT `complaint_messages_complaintId_complaints_id_fk` FOREIGN KEY (`complaintId`) REFERENCES `complaints`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complaint_messages` ADD CONSTRAINT `complaint_messages_senderId_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `messages_complaint_idx` ON `complaint_messages` (`complaintId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `messages_unread_idx` ON `complaint_messages` (`complaintId`,`senderRole`,`readAt`);