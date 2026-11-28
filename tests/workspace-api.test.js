"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../server");
const prisma = require("../src/db");
const { createSession } = require("../src/sessions");

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const USER_FILE_QUOTA = 50 * 1024 * 1024;
let server;
let base;
let userA;
let userB;

const asUser = (user) => {
  user.sid ??= createSession(user.id);
  return {
    "Content-Type": "application/json",
    Cookie: `sid=${user.sid}`,
  };
};

const send = (url, user, method = "GET", body) =>
  fetch(base + url, {
    method,
    headers: user ? asUser(user) : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function getWorkspace(user = userA) {
  const response = await send("/api/workspace", user);
  assert.equal(response.status, 200);
  return response.json();
}

async function createFolder(user, parentId, name) {
  const response = await send("/api/workspace/folders", user, "POST", { parentId, name });
  assert.equal(response.status, 201);
  return response.json();
}

async function createNote(user, folderId, name, text = "") {
  const response = await send("/api/workspace/items", user, "POST", {
    folderId,
    name,
    text,
  });
  assert.equal(response.status, 201);
  return response.json();
}

async function uploadFile(user, folderId, name, bytes, browserMimeType = "application/octet-stream") {
  const form = new FormData();
  form.append("folderId", folderId);
  form.append("file", new Blob([bytes], { type: browserMimeType }), name);
  return fetch(base + "/api/workspace/items/upload", {
    method: "POST",
    headers: { Cookie: `sid=${user.sid}` },
    body: form,
  });
}

function getRoot(workspace, rootKey) {
  const root = workspace.roots.find((folder) => folder.rootKey === rootKey);
  assert.ok(root, `missing ${rootKey} root folder`);
  return root;
}

test.before(async () => {
  server = app.listen(0);
  base = "http://localhost:" + server.address().port;
  const stamp = Date.now();
  userA = await prisma.user.create({
    data: {
      name: "Workspace Test A",
      email: `workspace-a-${stamp}@test.local`,
      passwordHash: "x",
    },
  });
  userB = await prisma.user.create({
    data: {
      name: "Workspace Test B",
      email: `workspace-b-${stamp}@test.local`,
      passwordHash: "x",
    },
  });
  asUser(userA);
  asUser(userB);
});

test.beforeEach(async () => {
  await prisma.workspaceFolder.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  });
});

test.after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
  server.close();
});

test("creates the default folders once, including under concurrent first visits", async () => {
  const [first, concurrent] = await Promise.all([
    getWorkspace(),
    getWorkspace(),
  ]);
  assert.deepEqual(first.roots.map((root) => root.name), [
    "Thesis Sections",
    "Notes",
    "Drafts",
    "Miscellaneous",
  ]);

  const thesisRoot = getRoot(first, "thesis_sections");
  const thesisTree = first.folderTree.find((folder) => folder.id === thesisRoot.id);
  assert.deepEqual(thesisTree.children.map((folder) => folder.name), [
    "Conclusion",
    "Introduction",
    "Literature Review",
    "Results",
  ]);
  assert.deepEqual(
    concurrent.roots.map((root) => root.id),
    first.roots.map((root) => root.id),
  );

  const again = await getWorkspace();
  assert.deepEqual(
    again.folderTree.find((folder) => folder.id === thesisRoot.id).children.map((folder) => folder.id),
    thesisTree.children.map((folder) => folder.id),
  );
  assert.equal(await prisma.workspaceFolder.count({ where: { userId: userA.id } }), 8);
});

test("does not seed Thesis Sections children when that root already exists", async () => {
  const root = await prisma.workspaceFolder.create({
    data: {
      userId: userA.id,
      name: "Thesis Sections",
      rootKey: "thesis_sections",
    },
  });
  const workspace = await getWorkspace();
  const tree = workspace.folderTree.find((folder) => folder.id === root.id);
  assert.deepEqual(tree.children, []);
});

test("creates nested folders and enforces the five-level depth limit", async () => {
  const workspace = await getWorkspace();
  let parent = getRoot(workspace, "notes");
  for (let depth = 2; depth <= 5; depth += 1) {
    parent = await createFolder(userA, parent.id, `Level ${depth}`);
  }
  const tooDeep = await send("/api/workspace/folders", userA, "POST", {
    parentId: parent.id,
    name: "Level 6",
  });
  assert.equal(tooDeep.status, 400);
  assert.match((await tooDeep.json()).error, /5 levels/);
});

test("rejects case-insensitive duplicate names and allows folder renaming", async () => {
  const workspace = await getWorkspace();
  const notesRoot = getRoot(workspace, "notes");
  const folder = await createFolder(userA, notesRoot.id, "Research");
  const duplicate = await send("/api/workspace/folders", userA, "POST", {
    parentId: notesRoot.id,
    name: "rEsEaRcH",
  });
  assert.equal(duplicate.status, 409);

  const rename = await send(`/api/workspace/folders/${folder.id}`, userA, "PATCH", {
    name: "Field Notes",
  });
  assert.equal(rename.status, 200);
  assert.equal((await rename.json()).name, "Field Notes");

  const note = await createNote(userA, notesRoot.id, "Interview");
  const duplicateNote = await send("/api/workspace/items", userA, "POST", {
    folderId: notesRoot.id,
    name: "interview",
    text: "",
  });
  assert.equal(duplicateNote.status, 409);
  const crossTypeDuplicate = await send("/api/workspace/folders", userA, "POST", {
    parentId: notesRoot.id,
    name: "interview",
  });
  assert.equal(crossTypeDuplicate.status, 409);
  assert.equal(note.name, "Interview");
});

test("validates folder names and the per-user folder limit", async () => {
  const workspace = await getWorkspace();
  const notesRoot = getRoot(workspace, "notes");
  for (const name of ["", "  ", "has/slash", "has\\backslash", "control\u0001char", "x".repeat(101)]) {
    const response = await send("/api/workspace/folders", userA, "POST", {
      parentId: notesRoot.id,
      name,
    });
    assert.equal(response.status, 400, JSON.stringify(name));
  }

  await prisma.workspaceFolder.createMany({
    data: Array.from({ length: 92 }, (_value, index) => ({
      userId: userA.id,
      parentId: notesRoot.id,
      name: `Limit folder ${index}`,
    })),
  });
  const overLimit = await send("/api/workspace/folders", userA, "POST", {
    parentId: notesRoot.id,
    name: "One too many",
  });
  assert.equal(overLimit.status, 409);
});

test("protects the four top-level folders from renaming and deletion", async () => {
  const workspace = await getWorkspace();
  const root = getRoot(workspace, "thesis_sections");
  const rename = await send(`/api/workspace/folders/${root.id}`, userA, "PATCH", {
    name: "Changed root",
  });
  assert.equal(rename.status, 403);

  const preview = await send(
    `/api/workspace/folders/${root.id}/delete-preview`,
    userA,
  );
  assert.equal(preview.status, 403);
  const deletion = await send(`/api/workspace/folders/${root.id}`, userA, "DELETE", {
    folderCount: 1,
    itemCount: 0,
  });
  assert.equal(deletion.status, 403);
});

test("deletes a subtree and reports the folders and items removed", async () => {
  const workspace = await getWorkspace();
  const notesRoot = getRoot(workspace, "notes");
  const parent = await createFolder(userA, notesRoot.id, "Parent folder");
  const child = await createFolder(userA, parent.id, "Child folder");
  await createNote(userA, child.id, "Nested note", "Text");

  const previewResponse = await send(
    `/api/workspace/folders/${parent.id}/delete-preview`,
    userA,
  );
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.deepEqual(preview, { folderCount: 2, itemCount: 1 });

  const deletion = await send(`/api/workspace/folders/${parent.id}`, userA, "DELETE", preview);
  assert.equal(deletion.status, 200);
  assert.deepEqual(await deletion.json(), preview);
  assert.equal(await prisma.workspaceFolder.count({
    where: { id: { in: [parent.id, child.id] }, userId: userA.id },
  }), 0);
  assert.equal(await prisma.workspaceItem.count({ where: { folderId: child.id } }), 0);
});

test("rejects a stale subtree deletion preview", async () => {
  const workspace = await getWorkspace();
  const notesRoot = getRoot(workspace, "notes");
  const folder = await createFolder(userA, notesRoot.id, "Changing folder");
  const previewResponse = await send(
    `/api/workspace/folders/${folder.id}/delete-preview`,
    userA,
  );
  const preview = await previewResponse.json();
  await createNote(userA, folder.id, "Added after preview");
  const deletion = await send(`/api/workspace/folders/${folder.id}`, userA, "DELETE", preview);
  assert.equal(deletion.status, 409);
});

test("computes recursive item counts and omits file data from listing responses", async () => {
  const workspace = await getWorkspace();
  const draftsRoot = getRoot(workspace, "drafts");
  const child = await createFolder(userA, draftsRoot.id, "Chapter drafts");
  const grandchild = await createFolder(userA, child.id, "Working");
  await createNote(userA, draftsRoot.id, "Root note");
  await createNote(userA, child.id, "Chapter note");
  await createNote(userA, grandchild.id, "Working note");

  const refreshed = await getWorkspace();
  assert.equal(getRoot(refreshed, "drafts").itemCount, 3);
  const contentsResponse = await send(`/api/workspace/folders/${child.id}`, userA);
  const contents = await contentsResponse.json();
  assert.equal(contents.items[0].name, "Chapter note");
  assert.equal("text" in contents.items[0], false);
  assert.equal("fileData" in contents.items[0], false);
  assert.equal("fileData" in refreshed.recentItems[0], false);
});

test("uploads and downloads a file just under 5 MiB byte-identically", async () => {
  const workspace = await getWorkspace();
  const draftsRoot = getRoot(workspace, "drafts");
  const original = Buffer.alloc(MAX_FILE_SIZE - 1, 0x41);
  const uploadResponse = await uploadFile(
    userA,
    draftsRoot.id,
    "large-note.txt",
    original,
    "application/x-browser-provided-value",
  );
  assert.equal(uploadResponse.status, 201);
  const item = await uploadResponse.json();
  assert.equal(item.size, original.length);
  assert.equal(item.mimeType, "text/plain");

  const download = await fetch(
    base + `/api/workspace/items/${item.id}/download`,
    { headers: { Cookie: `sid=${userA.sid}` } },
  );
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /attachment/);
  assert.equal(download.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), original);
});

test("rejects a file just over 5 MiB with 413", async () => {
  const workspace = await getWorkspace();
  const original = Buffer.alloc(MAX_FILE_SIZE + 1, 0x41);
  const response = await uploadFile(
    userA,
    getRoot(workspace, "drafts").id,
    "too-large.txt",
    original,
  );
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /5 MiB/);
});

test("validates upload extension and signature without trusting the client MIME type", async () => {
  const workspace = await getWorkspace();
  const folderId = getRoot(workspace, "miscellaneous").id;
  const badExtension = await uploadFile(
    userA,
    folderId,
    "wrong-extension.pdf",
    Buffer.from("not a PDF"),
    "application/pdf",
  );
  assert.equal(badExtension.status, 400);

  const badSignature = await uploadFile(
    userA,
    folderId,
    "fake.docx",
    Buffer.from("not a zip"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(badSignature.status, 400);

  const validDocxSignature = await uploadFile(
    userA,
    folderId,
    "valid-signature.docx",
    Buffer.from("PK archive signature"),
    "text/plain",
  );
  assert.equal(validDocxSignature.status, 201);
  assert.equal((await validDocxSignature.json()).mimeType,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

  const nullByteText = await uploadFile(
    userA,
    folderId,
    "invalid.txt",
    Buffer.from([0x41, 0x00, 0x42]),
    "text/plain",
  );
  assert.equal(nullByteText.status, 400);
});

test("sanitizes stored filenames and safely encodes download headers", async () => {
  const workspace = await getWorkspace();
  const response = await uploadFile(
    userA,
    getRoot(workspace, "miscellaneous").id,
    "../café.txt",
    Buffer.from("safe text"),
  );
  assert.equal(response.status, 201);
  const item = await response.json();
  assert.equal(item.name, "café.txt");

  const download = await fetch(
    base + `/api/workspace/items/${item.id}/download`,
    { headers: { Cookie: `sid=${userA.sid}` } },
  );
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /filename\*=UTF-8''caf%C3%A9\.txt/);
});

test("rejects uploads that would exceed the 50 MiB per-user quota", async () => {
  const workspace = await getWorkspace();
  const folderId = getRoot(workspace, "drafts").id;
  const maxFile = Buffer.alloc(MAX_FILE_SIZE, 0x41);
  for (let index = 0; index < USER_FILE_QUOTA / MAX_FILE_SIZE; index += 1) {
    const response = await uploadFile(
      userA,
      folderId,
      `quota-${index}.txt`,
      maxFile,
    );
    assert.equal(response.status, 201);
  }
  const overQuota = await uploadFile(userA, folderId, "quota-over.txt", Buffer.from("A"));
  assert.equal(overQuota.status, 409);
  assert.match((await overQuota.json()).error, /50 MiB/);
});

test("creates and edits notes and rejects empty titles or text over 100,000 characters", async () => {
  const workspace = await getWorkspace();
  const notesRoot = getRoot(workspace, "notes");
  const emptyTitle = await send("/api/workspace/items", userA, "POST", {
    folderId: notesRoot.id,
    name: " ",
    text: "Text",
  });
  assert.equal(emptyTitle.status, 400);
  const tooLongOnCreate = await send("/api/workspace/items", userA, "POST", {
    folderId: notesRoot.id,
    name: "Long note",
    text: "x".repeat(100001),
  });
  assert.equal(tooLongOnCreate.status, 400);

  const note = await createNote(userA, notesRoot.id, "Interview notes", "First draft");
  const edit = await send(`/api/workspace/items/${note.id}`, userA, "PATCH", {
    name: "Edited interview",
    text: "Updated text",
  });
  assert.equal(edit.status, 200);
  assert.equal((await edit.json()).name, "Edited interview");
  const detail = await send(`/api/workspace/items/${note.id}`, userA);
  assert.equal((await detail.json()).text, "Updated text");

  const tooLong = await send(`/api/workspace/items/${note.id}`, userA, "PATCH", {
    text: "x".repeat(100001),
  });
  assert.equal(tooLong.status, 400);
  assert.match((await tooLong.json()).error, /100,000 characters/);

  const deleted = await send(`/api/workspace/items/${note.id}`, userA, "DELETE");
  assert.equal(deleted.status, 204);
});

test("rejects path separators and control characters in item names", async () => {
  const workspace = await getWorkspace();
  const notesRoot = getRoot(workspace, "notes");
  const note = await createNote(userA, notesRoot.id, "Valid note");

  for (const name of ["has/slash", "has\\backslash", "control\u0001char"]) {
    const createResponse = await send("/api/workspace/items", userA, "POST", {
      folderId: notesRoot.id,
      name,
      text: "",
    });
    assert.equal(createResponse.status, 400, JSON.stringify(name));

    const renameResponse = await send(`/api/workspace/items/${note.id}`, userA, "PATCH", {
      name,
    });
    assert.equal(renameResponse.status, 400, JSON.stringify(name));
  }
});

test("orders recent items by most recently updated and includes their folder paths", async () => {
  const workspace = await getWorkspace();
  const notesRoot = getRoot(workspace, "notes");
  const child = await createFolder(userA, notesRoot.id, "Research notes");
  const first = await createNote(userA, child.id, "First note");
  await new Promise((resolve) => setTimeout(resolve, 10));
  await createNote(userA, notesRoot.id, "Second note");
  await new Promise((resolve) => setTimeout(resolve, 10));
  await send(`/api/workspace/items/${first.id}`, userA, "PATCH", { text: "Edited later" });

  const overview = await getWorkspace();
  assert.deepEqual(
    overview.recentItems.slice(0, 2).map((item) => item.name),
    ["First note", "Second note"],
  );
  assert.deepEqual(overview.recentItems[0].folderPath, ["Notes", "Research notes"]);
});

test("does not expose another user's folders or items", async () => {
  const workspace = await getWorkspace(userA);
  const notesRoot = getRoot(workspace, "notes");
  const folder = await createFolder(userA, notesRoot.id, "Private folder");
  const note = await createNote(userA, folder.id, "Private note", "Secret");

  for (const response of [
    await send(`/api/workspace/folders/${folder.id}`, userB),
    await send(`/api/workspace/folders/${folder.id}/delete-preview`, userB),
    await send(`/api/workspace/folders/${folder.id}`, userB, "PATCH", { name: "Changed" }),
    await send(`/api/workspace/folders/${folder.id}`, userB, "DELETE", {
      folderCount: 1,
      itemCount: 1,
    }),
    await send(`/api/workspace/items/${note.id}`, userB),
    await send(`/api/workspace/items/${note.id}`, userB, "PATCH", { name: "Changed" }),
    await send(`/api/workspace/items/${note.id}`, userB, "DELETE"),
    await fetch(base + `/api/workspace/items/${note.id}/download`, {
      headers: { Cookie: `sid=${userB.sid}` },
    }),
  ]) {
    assert.equal(response.status, 404);
  }
});

test("requires a logged-in user for workspace APIs", async () => {
  const response = await send("/api/workspace", null);
  assert.equal(response.status, 401);
});
