-- CreateTable
CREATE TABLE `ThesisProject` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `finalDeadline` VARCHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ThesisProject_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Milestone` (
    `id` VARCHAR(36) NOT NULL,
    `thesisProjectId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `targetDate` VARCHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Milestone_thesisProjectId_targetDate_idx`(`thesisProjectId`, `targetDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ThesisProject` ADD CONSTRAINT `ThesisProject_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Milestone` ADD CONSTRAINT `Milestone_thesisProjectId_fkey` FOREIGN KEY (`thesisProjectId`) REFERENCES `ThesisProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
