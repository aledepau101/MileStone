"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../server");
const prisma = require("../src/db");
const { createSession } = require("../src/sessions");

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

const send = (path, user, method = "GET", body) =>
  fetch(base + path, {
    method,
    headers: user ? asUser(user) : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function setDeadline(user, finalDeadline = "2030-04-30") {
  const response = await send("/api/thesis/deadline", user, "PUT", { finalDeadline });
  assert.equal(response.status, 200);
  return response.json();
}

test.before(async () => {
  server = app.listen(0);
  base = "http://localhost:" + server.address().port;
  const stamp = Date.now();
  userA = await prisma.user.create({
    data: { name: "Thesis Test A", email: `thesis-a-${stamp}@test.local`, passwordHash: "x" },
  });
  userB = await prisma.user.create({
    data: { name: "Thesis Test B", email: `thesis-b-${stamp}@test.local`, passwordHash: "x" },
  });
});

test.beforeEach(async () => {
  await prisma.thesisProject.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  });
});

test.after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
  server.close();
});

test("creates, lists in date order, edits, and deletes milestones", async () => {
  await setDeadline(userA);
  const later = await send("/api/milestones", userA, "POST", {
    name: " Literature review ",
    targetDate: "2030-02-01",
  });
  assert.equal(later.status, 201);
  const laterMilestone = await later.json();
  assert.equal(laterMilestone.name, "Literature review");

  const earlier = await send("/api/milestones", userA, "POST", {
    name: "Research proposal",
    targetDate: "2030-01-01",
  });
  assert.equal(earlier.status, 201);
  const earlierMilestone = await earlier.json();

  const listResponse = await send("/api/thesis", userA);
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  assert.equal(list.finalDeadline, "2030-04-30");
  assert.deepEqual(list.milestones.map((milestone) => milestone.id), [
    earlierMilestone.id,
    laterMilestone.id,
  ]);

  const updated = await send(`/api/milestones/${earlierMilestone.id}`, userA, "PUT", {
    name: "Final research proposal",
    targetDate: "2030-02-15",
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).name, "Final research proposal");

  const reordered = await (await send("/api/thesis", userA)).json();
  assert.deepEqual(reordered.milestones.map((milestone) => milestone.id), [
    laterMilestone.id,
    earlierMilestone.id,
  ]);

  const deleted = await send(`/api/milestones/${earlierMilestone.id}`, userA, "DELETE");
  assert.equal(deleted.status, 204);
  const afterDelete = await (await send("/api/thesis", userA)).json();
  assert.deepEqual(afterDelete.milestones.map((milestone) => milestone.id), [
    laterMilestone.id,
  ]);
});

test("accepts a milestone target date equal to the final deadline", async () => {
  await setDeadline(userA, "2030-04-30");
  const response = await send("/api/milestones", userA, "POST", {
    name: "Final thesis and defense",
    targetDate: "2030-04-30",
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).targetDate, "2030-04-30");
});

test("rejects missing or blank milestone names", async () => {
  await setDeadline(userA);
  for (const body of [
    { targetDate: "2030-03-01" },
    { name: "   ", targetDate: "2030-03-01" },
    { name: "a".repeat(201), targetDate: "2030-03-01" },
  ]) {
    const response = await send("/api/milestones", userA, "POST", body);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).errors.name);
  }
});

test("requires a deadline and rejects dates after it or invalid calendar dates", async () => {
  const emptyThesis = await (await send("/api/thesis", userA)).json();
  assert.deepEqual(emptyThesis, { finalDeadline: null, milestones: [] });

  const invalidDeadline = await send("/api/thesis/deadline", userA, "PUT", {
    finalDeadline: "2030-02-30",
  });
  assert.equal(invalidDeadline.status, 400);

  const noDeadline = await send("/api/milestones", userA, "POST", {
    name: "Proposal",
    targetDate: "2030-03-01",
  });
  assert.equal(noDeadline.status, 400);

  await setDeadline(userA, "2030-04-30");
  const afterDeadline = await send("/api/milestones", userA, "POST", {
    name: "Too late",
    targetDate: "2030-05-01",
  });
  assert.equal(afterDeadline.status, 400);

  const invalidDate = await send("/api/milestones", userA, "POST", {
    name: "Invalid date",
    targetDate: "2030-02-30",
  });
  assert.equal(invalidDate.status, 400);
});

test("rejects moving the deadline before existing milestones and lists conflicts", async () => {
  await setDeadline(userA, "2030-04-30");
  const created = await send("/api/milestones", userA, "POST", {
    name: "Methods draft",
    targetDate: "2030-03-20",
  });
  const milestone = await created.json();

  const response = await send("/api/thesis/deadline", userA, "PUT", {
    finalDeadline: "2030-03-10",
  });
  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).conflicts.map((item) => item.id), [milestone.id]);

  const thesis = await (await send("/api/thesis", userA)).json();
  assert.equal(thesis.finalDeadline, "2030-04-30");
});

test("a user cannot edit or delete another user's milestone", async () => {
  await setDeadline(userA);
  const response = await send("/api/milestones", userA, "POST", {
    name: "Private milestone",
    targetDate: "2030-03-01",
  });
  const milestone = await response.json();
  await setDeadline(userB);

  const update = await send(`/api/milestones/${milestone.id}`, userB, "PUT", {
    name: "Changed",
    targetDate: "2030-03-02",
  });
  assert.equal(update.status, 404);

  const deletion = await send(`/api/milestones/${milestone.id}`, userB, "DELETE");
  assert.equal(deletion.status, 404);

  const ownerThesis = await (await send("/api/thesis", userA)).json();
  assert.equal(ownerThesis.milestones[0].name, "Private milestone");
});

test("requests without a logged-in user get 401", async () => {
  for (const [path, method, body] of [
    ["/api/thesis", "GET"],
    ["/api/thesis/deadline", "PUT", { finalDeadline: "2030-04-30" }],
    ["/api/milestones", "POST", { name: "Proposal", targetDate: "2030-03-01" }],
    ["/api/milestones/missing-id", "PUT", { name: "Proposal", targetDate: "2030-03-01" }],
    ["/api/milestones/missing-id", "DELETE"],
  ]) {
    const response = await send(path, null, method, body);
    assert.equal(response.status, 401, `${method} ${path}`);
  }
});
