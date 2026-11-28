-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(36) NOT NULL,
    `milestoneId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `dueDate` VARCHAR(10) NOT NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_milestoneId_dueDate_idx`(`milestoneId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `Milestone`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
