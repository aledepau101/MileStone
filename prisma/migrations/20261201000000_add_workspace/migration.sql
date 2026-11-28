-- CreateTable
CREATE TABLE `WorkspaceFolder` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `parentId` VARCHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `rootKey` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkspaceFolder_userId_parentId_idx`(`userId`, `parentId`),
    UNIQUE INDEX `WorkspaceFolder_userId_rootKey_key`(`userId`, `rootKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkspaceItem` (
    `id` VARCHAR(36) NOT NULL,
    `folderId` VARCHAR(36) NOT NULL,
    `kind` ENUM('upload', 'note') NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `mimeType` VARCHAR(100) NULL,
    `size` INTEGER NULL,
    `fileData` LONGBLOB NULL,
    `text` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkspaceItem_folderId_updatedAt_idx`(`folderId`, `updatedAt`),
    INDEX `WorkspaceItem_folderId_name_idx`(`folderId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkspaceFolder` ADD CONSTRAINT `WorkspaceFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceFolder` ADD CONSTRAINT `WorkspaceFolder_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `WorkspaceFolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceItem` ADD CONSTRAINT `WorkspaceItem_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `WorkspaceFolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
