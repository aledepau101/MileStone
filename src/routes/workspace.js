"use strict";

const express = require("express");
const multer = require("multer");
const path = require("node:path");
const prisma = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const USER_FILE_QUOTA = 50 * 1024 * 1024;
const MAX_NOTE_LENGTH = 100000;
const MAX_FOLDERS = 100;
const ROOT_FOLDERS = [
  { rootKey: "thesis_sections", name: "Thesis Sections" },
  { rootKey: "notes", name: "Notes" },
  { rootKey: "drafts", name: "Drafts" },
  { rootKey: "miscellaneous", name: "Miscellaneous" },
];
const THESIS_SUBFOLDERS = [
  "Introduction",
  "Literature Review",
  "Results",
  "Conclusion",
];
const UPLOAD_TYPES = {
  ".pdf": {
    mimeType: "application/pdf",
    hasSignature: (buffer) => buffer.length >= 4 && buffer.subarray(0, 4).toString() === "%PDF",
  },
  ".docx": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    hasSignature: (buffer) => buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b,
  },
  ".txt": {
    mimeType: "text/plain",
    hasSignature: (buffer) => !buffer.includes(0),
  },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 1,
    parts: 2,
  },
});

class WorkspaceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function respondWithError(res, error, context) {
  if (error instanceof WorkspaceError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(`Workspace API request failed (${context}).`, error);
  return res.status(500).json({ error: "An unexpected error occurred." });
}

function isUniqueConstraintError(error) {
  return Boolean(error && error.code === "P2002");
}

async function lockWorkspaceUser(tx, userId) {
  await tx.$queryRawUnsafe(
    "SELECT id FROM `User` WHERE id = ? FOR UPDATE",
    userId,
  );
}

async function ensureWorkspace(userId) {
  for (const rootDefinition of ROOT_FOLDERS) {
    const where = {
      userId_rootKey: { userId, rootKey: rootDefinition.rootKey },
    };
    const existing = await prisma.workspaceFolder.findUnique({
      where,
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await lockWorkspaceUser(tx, userId);
        const current = await tx.workspaceFolder.findUnique({
          where,
          select: { id: true },
        });
        if (current) {
          return;
        }

        const root = await tx.workspaceFolder.create({
          data: {
            userId,
            name: rootDefinition.name,
            rootKey: rootDefinition.rootKey,
          },
          select: { id: true },
        });

        if (rootDefinition.rootKey === "thesis_sections") {
          await tx.workspaceFolder.createMany({
            data: THESIS_SUBFOLDERS.map((name) => ({
              userId,
              parentId: root.id,
              name,
            })),
          });
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const winner = await prisma.workspaceFolder.findUnique({
        where,
        select: { id: true },
      });
      if (!winner) {
        throw error;
      }
    }
  }
}

async function loadFolderTree(client, userId) {
  const rows = await client.workspaceFolder.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      parentId: true,
      name: true,
      rootKey: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const nodesById = new Map();
  rows.forEach((row) => {
    nodesById.set(row.id, { ...row, depth: 0, children: [] });
  });

  const roots = [];
  nodesById.forEach((node) => {
    const parent = node.parentId ? nodesById.get(node.parentId) : null;
    if (parent) {
      node.depth = parent.depth ? parent.depth + 1 : 2;
      parent.children.push(node);
    } else {
      node.depth = 1;
      roots.push(node);
    }
  });

  const setChildDepths = (node) => {
    node.children.forEach((child) => {
      child.depth = node.depth + 1;
      setChildDepths(child);
    });
  };
  roots.forEach(setChildDepths);

  return { rows, roots, nodesById };
}

function toFolderSummary(folder) {
  return {
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    rootKey: folder.rootKey,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

function toFolderTree(folder) {
  return {
    ...toFolderSummary(folder),
    children: folder.children.map(toFolderTree),
  };
}

function toClientItem(item) {
  return {
    id: item.id,
    folderId: item.folderId,
    kind: item.kind,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function getBreadcrumbs(folder, nodesById) {
  const breadcrumbs = [];
  let current = folder;
  while (current) {
    breadcrumbs.unshift(toFolderSummary(current));
    current = current.parentId ? nodesById.get(current.parentId) : null;
  }
  return breadcrumbs;
}

function getSubtreeIds(folder) {
  const ids = [];
  const visit = (node) => {
    ids.push(node.id);
    node.children.forEach(visit);
  };
  visit(folder);
  return ids;
}

function getFolderNameInput(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) {
    throw new WorkspaceError(400, "Folder name is required.");
  }
  if (Array.from(name).length > 100) {
    throw new WorkspaceError(400, "Folder names must be 100 characters or fewer.");
  }
  if (/[\\/]/.test(name) || hasControlCharacters(name)) {
    throw new WorkspaceError(400, "Folder names cannot contain path separators or control characters.");
  }
  return name;
}

function hasControlCharacters(value) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

function getItemNameInput(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) {
    throw new WorkspaceError(400, "Item name is required.");
  }
  if (Array.from(name).length > 200) {
    throw new WorkspaceError(400, "Item names must be 200 characters or fewer.");
  }
  if (/[\\/]/.test(name) || hasControlCharacters(name)) {
    throw new WorkspaceError(400, "Item names cannot contain path separators or control characters.");
  }
  return name;
}

function sanitizeFileName(value) {
  const pathParts = String(value || "").split(/[\\/]/);
  const lastPart = pathParts[pathParts.length - 1] || "";
  const sanitized = Array.from(lastPart)
    .filter((character) => !hasControlCharacters(character))
    .join("")
    .trim();
  return Array.from(sanitized).slice(0, 200).join("");
}

function getRequestObject(body) {
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

async function getOwnedFolder(tx, userId, folderId) {
  const folder = await tx.workspaceFolder.findFirst({
    where: { id: folderId, userId },
    select: {
      id: true,
      userId: true,
      parentId: true,
      name: true,
      rootKey: true,
    },
  });
  if (!folder) {
    throw new WorkspaceError(404, "Folder not found.");
  }
  return folder;
}

async function assertNameAvailable(tx, folderId, name, excluded) {
  const normalizedName = name.toLowerCase();
  const [folders, items] = await Promise.all([
    tx.workspaceFolder.findMany({
      where: {
        parentId: folderId,
        ...(excluded.folderId ? { id: { not: excluded.folderId } } : {}),
      },
      select: { name: true },
    }),
    tx.workspaceItem.findMany({
      where: {
        folderId,
        ...(excluded.itemId ? { id: { not: excluded.itemId } } : {}),
      },
      select: { name: true },
    }),
  ]);
  if (
    folders.some((entry) => entry.name.toLowerCase() === normalizedName)
    || items.some((entry) => entry.name.toLowerCase() === normalizedName)
  ) {
    throw new WorkspaceError(409, "An item or folder with that name already exists here.");
  }
}

function requireFolderId(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new WorkspaceError(400, "A folder is required.");
  }
  return value;
}

function getUploadMiddleware(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Files must be 5 MiB or smaller." });
        return;
      }
      res.status(400).json({ error: "The upload request is invalid." });
      return;
    }
    console.error("Workspace upload processing failed.", error);
    res.status(500).json({ error: "An unexpected error occurred." });
  });
}

function getFileType(file) {
  const decodedName = Buffer.from(file.originalname, "latin1").toString("utf8");
  const fileName = sanitizeFileName(decodedName);
  if (!fileName) {
    throw new WorkspaceError(400, "The file must have a valid name.");
  }
  const extension = path.extname(fileName).toLowerCase();
  const type = UPLOAD_TYPES[extension];
  if (!type) {
    throw new WorkspaceError(400, "Only PDF, DOCX, and TXT files are accepted.");
  }
  return { fileName, ...type };
}

function getSafeContentDisposition(fileName) {
  const asciiName = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    await ensureWorkspace(userId);
    const [tree, itemCounts] = await Promise.all([
      loadFolderTree(prisma, userId),
      prisma.workspaceItem.groupBy({
        by: ["folderId"],
        where: { folder: { is: { userId } } },
        _count: { _all: true },
      }),
    ]);
    const countsByFolder = new Map(
      itemCounts.map((entry) => [entry.folderId, entry._count._all]),
    );
    const getRecursiveCount = (folder) => {
      let total = countsByFolder.get(folder.id) || 0;
      folder.children.forEach((child) => {
        total += getRecursiveCount(child);
      });
      return total;
    };
    const rootByKey = new Map(tree.roots.map((root) => [root.rootKey, root]));
    const roots = ROOT_FOLDERS.map((definition) => {
      const folder = rootByKey.get(definition.rootKey);
      return {
        ...toFolderSummary(folder),
        itemCount: getRecursiveCount(folder),
      };
    });

    const recentItems = await prisma.workspaceItem.findMany({
      where: { folder: { is: { userId } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        folderId: true,
        kind: true,
        name: true,
        mimeType: true,
        size: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const recent = recentItems.map((item) => ({
      ...toClientItem(item),
      folderPath: getBreadcrumbs(tree.nodesById.get(item.folderId), tree.nodesById)
        .map((folder) => folder.name),
    }));

    res.json({
      roots,
      folderTree: tree.roots.map(toFolderTree),
      recentItems: recent,
    });
  } catch (error) {
    respondWithError(res, error, "overview");
  }
});

router.get("/folders/:id", async (req, res) => {
  try {
    const tree = await loadFolderTree(prisma, req.user.id);
    const folder = tree.nodesById.get(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: "Folder not found." });
    }

    const items = await prisma.workspaceItem.findMany({
      where: { folderId: folder.id },
      orderBy: [{ kind: "asc" }, { name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        folderId: true,
        kind: true,
        name: true,
        mimeType: true,
        size: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({
      folder: toFolderSummary(folder),
      breadcrumbs: getBreadcrumbs(folder, tree.nodesById),
      subfolders: folder.children.map(toFolderSummary),
      items: items.map(toClientItem),
    });
  } catch (error) {
    respondWithError(res, error, "folder contents");
  }
});

router.post("/folders", async (req, res) => {
  try {
    const body = getRequestObject(req.body);
    const name = getFolderNameInput(body.name);
    const parentId = requireFolderId(body.parentId);
    const userId = req.user.id;
    const folder = await prisma.$transaction(async (tx) => {
      await lockWorkspaceUser(tx, userId);
      const tree = await loadFolderTree(tx, userId);
      const parent = tree.nodesById.get(parentId);
      if (!parent) {
        throw new WorkspaceError(404, "Folder not found.");
      }
      if (parent.depth >= 5) {
        throw new WorkspaceError(400, "Folders can be nested up to 5 levels.");
      }
      if (tree.rows.length >= MAX_FOLDERS) {
        throw new WorkspaceError(409, "You can have up to 100 folders.");
      }
      await assertNameAvailable(tx, parentId, name, {});
      return tx.workspaceFolder.create({
        data: { userId, parentId, name },
      });
    });
    res.status(201).json(toFolderSummary(folder));
  } catch (error) {
    respondWithError(res, error, "create folder");
  }
});

router.patch("/folders/:id", async (req, res) => {
  try {
    const name = getFolderNameInput(getRequestObject(req.body).name);
    const userId = req.user.id;
    const folder = await prisma.$transaction(async (tx) => {
      await lockWorkspaceUser(tx, userId);
      const existing = await getOwnedFolder(tx, userId, req.params.id);
      if (existing.rootKey) {
        throw new WorkspaceError(403, "The four top-level folders cannot be renamed.");
      }
      await assertNameAvailable(tx, existing.parentId, name, { folderId: existing.id });
      return tx.workspaceFolder.update({
        where: { id: existing.id },
        data: { name },
      });
    });
    res.json(toFolderSummary(folder));
  } catch (error) {
    respondWithError(res, error, "rename folder");
  }
});

router.get("/folders/:id/delete-preview", async (req, res) => {
  try {
    const tree = await loadFolderTree(prisma, req.user.id);
    const folder = tree.nodesById.get(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: "Folder not found." });
    }
    if (folder.rootKey) {
      return res.status(403).json({ error: "The four top-level folders cannot be deleted." });
    }
    const folderIds = getSubtreeIds(folder);
    const itemCount = await prisma.workspaceItem.count({
      where: { folderId: { in: folderIds } },
    });
    res.json({ folderCount: folderIds.length, itemCount });
  } catch (error) {
    respondWithError(res, error, "folder delete preview");
  }
});

router.delete("/folders/:id", async (req, res) => {
  try {
    const body = getRequestObject(req.body);
    if (!Number.isInteger(body.folderCount) || !Number.isInteger(body.itemCount)) {
      return res.status(400).json({ error: "Confirm the folder deletion counts first." });
    }
    const userId = req.user.id;
    const deleted = await prisma.$transaction(async (tx) => {
      await lockWorkspaceUser(tx, userId);
      const tree = await loadFolderTree(tx, userId);
      const folder = tree.nodesById.get(req.params.id);
      if (!folder) {
        throw new WorkspaceError(404, "Folder not found.");
      }
      if (folder.rootKey) {
        throw new WorkspaceError(403, "The four top-level folders cannot be deleted.");
      }
      const folderIds = getSubtreeIds(folder);
      const itemCount = await tx.workspaceItem.count({
        where: { folderId: { in: folderIds } },
      });
      const folderCount = folderIds.length;
      if (body.folderCount !== folderCount || body.itemCount !== itemCount) {
        throw new WorkspaceError(409, "Folder contents changed. Review the deletion preview again.");
      }
      await tx.workspaceFolder.delete({
        where: { id: folder.id },
      });
      return { folderCount, itemCount };
    });
    res.json(deleted);
  } catch (error) {
    respondWithError(res, error, "delete folder");
  }
});

router.post("/items/upload", getUploadMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Choose a file to upload." });
    }
    const body = getRequestObject(req.body);
    const folderId = requireFolderId(body.folderId);
    const { fileName, mimeType, hasSignature } = getFileType(req.file);
    if (!hasSignature(req.file.buffer)) {
      return res.status(400).json({ error: "The file contents do not match its extension." });
    }

    const userId = req.user.id;
    const item = await prisma.$transaction(async (tx) => {
      await lockWorkspaceUser(tx, userId);
      const folder = await getOwnedFolder(tx, userId, folderId);
      await assertNameAvailable(tx, folder.id, fileName, {});
      const currentUsage = await tx.workspaceItem.aggregate({
        where: {
          kind: "upload",
          folder: { is: { userId } },
        },
        _sum: { size: true },
      });
      const usedBytes = currentUsage._sum.size || 0;
      if (usedBytes + req.file.size > USER_FILE_QUOTA) {
        throw new WorkspaceError(409, "Your 50 MiB workspace file quota would be exceeded.");
      }
      return tx.workspaceItem.create({
        data: {
          folderId: folder.id,
          kind: "upload",
          name: fileName,
          mimeType,
          size: req.file.size,
          fileData: req.file.buffer,
        },
      });
    });
    res.status(201).json(toClientItem(item));
  } catch (error) {
    respondWithError(res, error, "upload file");
  }
});

router.post("/items", async (req, res) => {
  try {
    const body = getRequestObject(req.body);
    const folderId = requireFolderId(body.folderId);
    const name = getItemNameInput(body.name);
    if (typeof body.text !== "string") {
      return res.status(400).json({ error: "Note text is required." });
    }
    if (Array.from(body.text).length > MAX_NOTE_LENGTH) {
      return res.status(400).json({ error: "Note text must be 100,000 characters or fewer." });
    }

    const userId = req.user.id;
    const item = await prisma.$transaction(async (tx) => {
      await lockWorkspaceUser(tx, userId);
      const folder = await getOwnedFolder(tx, userId, folderId);
      await assertNameAvailable(tx, folder.id, name, {});
      return tx.workspaceItem.create({
        data: {
          folderId: folder.id,
          kind: "note",
          name,
          text: body.text,
        },
      });
    });
    res.status(201).json({ ...toClientItem(item), text: item.text });
  } catch (error) {
    respondWithError(res, error, "create note");
  }
});

router.get("/items/:id", async (req, res) => {
  try {
    const item = await prisma.workspaceItem.findFirst({
      where: {
        id: req.params.id,
        folder: { is: { userId: req.user.id } },
        kind: "note",
      },
      select: {
        id: true,
        folderId: true,
        kind: true,
        name: true,
        text: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!item) {
      return res.status(404).json({ error: "Note not found." });
    }
    res.json(item);
  } catch (error) {
    respondWithError(res, error, "read note");
  }
});

router.patch("/items/:id", async (req, res) => {
  try {
    const body = getRequestObject(req.body);
    const userId = req.user.id;
    const updated = await prisma.$transaction(async (tx) => {
      await lockWorkspaceUser(tx, userId);
      const existing = await tx.workspaceItem.findFirst({
        where: {
          id: req.params.id,
          folder: { is: { userId } },
        },
        select: {
          id: true,
          folderId: true,
          kind: true,
          name: true,
        },
      });
      if (!existing) {
        throw new WorkspaceError(404, "Item not found.");
      }

      const data = {};
      if (Object.prototype.hasOwnProperty.call(body, "name")) {
        data.name = getItemNameInput(body.name);
        await assertNameAvailable(tx, existing.folderId, data.name, { itemId: existing.id });
      }
      if (Object.prototype.hasOwnProperty.call(body, "text")) {
        if (existing.kind !== "note" || typeof body.text !== "string") {
          throw new WorkspaceError(400, "Only notes can be edited.");
        }
        if (Array.from(body.text).length > MAX_NOTE_LENGTH) {
          throw new WorkspaceError(400, "Note text must be 100,000 characters or fewer.");
        }
        data.text = body.text;
      }
      if (!Object.keys(data).length) {
        throw new WorkspaceError(400, "Provide a new item name or note text.");
      }

      return tx.workspaceItem.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          folderId: true,
          kind: true,
          name: true,
          mimeType: true,
          size: true,
          text: existing.kind === "note",
          createdAt: true,
          updatedAt: true,
        },
      });
    });
    res.json(updated);
  } catch (error) {
    respondWithError(res, error, "update item");
  }
});

router.delete("/items/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    await prisma.$transaction(async (tx) => {
      await lockWorkspaceUser(tx, userId);
      const item = await tx.workspaceItem.findFirst({
        where: {
          id: req.params.id,
          folder: { is: { userId } },
        },
        select: { id: true },
      });
      if (!item) {
        throw new WorkspaceError(404, "Item not found.");
      }
      await tx.workspaceItem.delete({ where: { id: item.id } });
    });
    res.status(204).end();
  } catch (error) {
    respondWithError(res, error, "delete item");
  }
});

router.get("/items/:id/download", async (req, res) => {
  try {
    const item = await prisma.workspaceItem.findFirst({
      where: {
        id: req.params.id,
        folder: { is: { userId: req.user.id } },
        kind: "upload",
      },
      select: {
        name: true,
        mimeType: true,
        size: true,
        fileData: true,
      },
    });
    if (!item) {
      return res.status(404).json({ error: "File not found." });
    }
    res.set({
      "Content-Type": item.mimeType,
      "Content-Length": String(item.size),
      "Content-Disposition": getSafeContentDisposition(item.name),
      "X-Content-Type-Options": "nosniff",
    });
    res.end(Buffer.from(item.fileData));
  } catch (error) {
    respondWithError(res, error, "download file");
  }
});

module.exports = router;
