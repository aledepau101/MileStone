const test = require("node:test");
const assert = require("node:assert/strict");
const { signup, login } = require("../src/auth-service.js");
const sessions = require("../src/sessions.js");
const sessionToUser = require("../src/middleware/sessionToUser.js");

function createDeps() {
  const users = [];
  const prisma = {
    user: {
      findUnique: async ({ where }) =>
        users.find((user) => (where.email ? user.email === where.email : user.id === where.id)) ?? null,
      create: async ({ data }) => {
        const user = { id: `id-${users.length + 1}`, ...data };
        users.push(user);
        return user;
      },
    },
  };
  const bcrypt = {
    hash: async (password) => `hash:${password}`,
    compare: async (password, hash) => hash === `hash:${password}`,
  };
  return { users, prisma, bcrypt };
}

const newAccount = {
  name: "Ada Lovelace",
  email: "Ada@University.edu",
  password: "analytical8",
  role: "student",
};

test("signup saves a hashed password and returns the user without it", async () => {
  const deps = createDeps();
  const result = await signup(newAccount, deps);

  assert.equal(result.status, 201);
  assert.deepEqual(result.body, {
    id: "id-1",
    name: "Ada Lovelace",
    email: "ada@university.edu",
    role: "student",
  });
  assert.equal(result.userId, "id-1");
  assert.equal(deps.users[0].passwordHash, "hash:analytical8");
  assert.equal("password" in deps.users[0], false);
});

test("signup rejects invalid fields", async () => {
  const result = await signup({ name: " ", email: "nope", password: "short", role: "admin" }, createDeps());

  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body.errors).sort(), ["email", "fullName", "password", "role"]);
});

test("signup rejects a duplicate email regardless of case", async () => {
  const deps = createDeps();
  await signup(newAccount, deps);
  const result = await signup({ ...newAccount, email: "ADA@university.edu" }, deps);

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { errors: { email: "This email is already registered." } });
  assert.equal(deps.users.length, 1);
});

test("login succeeds with the right email, password, and role", async () => {
  const deps = createDeps();
  await signup(newAccount, deps);
  const result = await login({ email: " ada@university.edu ", password: "analytical8", role: "student" }, deps);

  assert.equal(result.status, 200);
  assert.equal(result.body.name, "Ada Lovelace");
  assert.equal("passwordHash" in result.body, false);
  assert.equal(result.userId, "id-1");
});

test("login rejects a wrong password, unknown email, or wrong role with one generic error", async () => {
  const deps = createDeps();
  await signup(newAccount, deps);
  const generic = { error: "Incorrect email, password, or account type." };

  for (const attempt of [
    { email: "ada@university.edu", password: "wrongpass1", role: "student" },
    { email: "nobody@university.edu", password: "analytical8", role: "student" },
    { email: "ada@university.edu", password: "analytical8", role: "advisor" },
  ]) {
    const result = await login(attempt, deps);
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, generic);
    assert.equal(result.userId, undefined);
  }
});

test("login validates empty fields before touching the database", async () => {
  const result = await login({ email: "", password: "" }, createDeps());

  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body.errors).sort(), ["email", "password"]);
});

test("sessions map an id to a user and can be destroyed", () => {
  const sessionId = sessions.createSession("user-1");

  assert.equal(sessions.getUserId(sessionId), "user-1");
  sessions.destroySession(sessionId);
  assert.equal(sessions.getUserId(sessionId), null);
  assert.equal(sessions.getUserId("not-a-session"), null);
});

test("parseCookies reads multiple cookies and ignores bad input", () => {
  assert.deepEqual(sessions.parseCookies("a=1; sid=abc%20def; b=2"), { a: "1", sid: "abc def", b: "2" });
  assert.deepEqual(sessions.parseCookies(undefined), {});
});

test("sessionToUser sets x-user-id from a valid session cookie", () => {
  const sessionId = sessions.createSession("user-7");
  const req = { headers: { cookie: `sid=${sessionId}` } };
  let called = false;

  sessionToUser(req, {}, () => { called = true; });

  assert.equal(called, true);
  assert.equal(req.headers["x-user-id"], "user-7");
});

test("sessionToUser removes a faked x-user-id when there is no valid session", () => {
  const req = { headers: { "x-user-id": "someone-else", cookie: "sid=bogus" } };

  sessionToUser(req, {}, () => {});

  assert.equal("x-user-id" in req.headers, false);
});
