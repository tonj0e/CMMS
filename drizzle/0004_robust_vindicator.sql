ALTER TABLE `users` ADD `studentId` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `admissionNumber` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_studentId_unique` UNIQUE(`studentId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_admissionNumber_unique` UNIQUE(`admissionNumber`);