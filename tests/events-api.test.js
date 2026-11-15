"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../server");
const prisma = require("../src/db");

let server;
let base;
let userA;
let userB;

// TEMPORARY auth: sends x-user-id. Update when the real login lands.
const asUser = (user) => ({
  "Content-Type": "application/json",
  "x-user-id": user.id,
});

const send = (path, user, method = "GET", body) =>
  fetch(base + path, {
    method,
    headers: asUser(user),
    body: body ? JSON.stringify(body) : undefined,
  });

test.before(async () => {
  server = app.listen(0);
  base = "http://localhost:" + server.address().port;
  const stamp = Date.now();
  userA = await prisma.user.create({
    data: { name: "Test A", email: `a${stamp}@test.local`, passwordHash: "x" },
  });
  userB = await prisma.user.create({
    data: { name: "Test B", email: `b${stamp}@test.local`, passwordHash: "x" },
  });
});

test.after(async () => {
  // Deleting the users also deletes their events (cascade).
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
  server.close();
});

test("create, read, update, and delete an event", async () => {
  const input = {
    title: "Proposal draft",
    date: "2026-11-20",
    endDate: "2026-11-21",
    time: "09:00",
    endTime: "10:30",
    location: "Library",
    type: "deadline",
    description: "First draft",
  };

  const created = await send("/api/events", userA, "POST", input);
  assert.equal(created.status, 201);
  const event = await created.json();
  assert.ok(event.id);
  assert.deepEqual({ ...event, id: undefined }, { ...input, id: undefined });

  const list = await (await send("/api/events", userA)).json();
  assert.ok(list.some((e) => e.id === event.id));

  const updated = await send(`/api/events/${event.id}`, userA, "PUT", {
    ...input,
    title: "Proposal final",
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).title, "Proposal final");

  const deleted = await send(`/api/events/${event.id}`, userA, "DELETE");
  assert.equal(deleted.status, 204);

  const after = await (await send("/api/events", userA)).json();
  assert.ok(!after.some((e) => e.id === event.id));
});

test("rejects invalid input with 400", async () => {
  const cases = [
    { date: "2026-11-20" },                                      // no title
    { title: "No date" },                                         // no date
    { title: "Bad date", date: "2026-02-30" },
    { title: "Bad type", date: "2026-11-20", type: "party" },
    { title: "Backwards", date: "2026-11-20", endDate: "2026-11-19" },
    { title: "Bad time", date: "2026-11-20", time: "25:00" },
  ];
  for (const body of cases) {
    const res = await send("/api/events", userA, "POST", body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test("a user cannot see or change another user's events", async () => {
  const res = await send("/api/events", userA, "POST", {
    title: "Private",
    date: "2026-11-22",
  });
  const event = await res.json();

  const listB = await (await send("/api/events", userB)).json();
  assert.ok(!listB.some((e) => e.id === event.id));

  const put = await send(`/api/events/${event.id}`, userB, "PUT", {
    title: "Hacked",
    date: "2026-11-22",
  });
  assert.equal(put.status, 404);

  const del = await send(`/api/events/${event.id}`, userB, "DELETE");
  assert.equal(del.status, 404);

  // Still there for the owner, unchanged.
  const listA = await (await send("/api/events", userA)).json();
  assert.equal(listA.find((e) => e.id === event.id).title, "Private");
});

test("requests without a logged-in user get 401", async () => {
  const res = await fetch(base + "/api/events");
  assert.equal(res.status, 401);
});