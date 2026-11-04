const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLoginFields } = require("../js/validation.js");
const { authenticate } = require("../js/auth.js");

const accounts = [
  { name: "Ana Lee", email: "ana@uni.edu", password: "password123", role: "student" },
  { name: "Dr. Kim", email: "kim@uni.edu", password: "advisorpass", role: "advisor" },
];

test("login validation requires email and password", () => {
  assert.deepEqual(validateLoginFields({ email: "", password: "" }), {
    email: "University email is required.",
    password: "Password is required.",
  });
});

test("login validation rejects an invalid email format", () => {
  assert.deepEqual(validateLoginFields({ email: "not-an-email", password: "x" }), {
    email: "Enter a valid email address.",
  });
});

test("login validation passes with a valid email and password", () => {
  assert.deepEqual(validateLoginFields({ email: "ana@uni.edu", password: "x" }), {});
});

test("authenticate returns the session for matching credentials", () => {
  assert.deepEqual(
    authenticate(accounts, { email: "ana@uni.edu", password: "password123", role: "student" }),
    { name: "Ana Lee", email: "ana@uni.edu", role: "student" },
  );
});

test("authenticate ignores email case and surrounding spaces", () => {
  assert.equal(
    authenticate(accounts, { email: "  ANA@Uni.edu ", password: "password123", role: "student" })?.name,
    "Ana Lee",
  );
});

test("authenticate never returns the password", () => {
  const session = authenticate(accounts, { email: "ana@uni.edu", password: "password123" });
  assert.equal("password" in session, false);
});

test("authenticate rejects a wrong password, unknown email, or wrong role", () => {
  assert.equal(authenticate(accounts, { email: "ana@uni.edu", password: "wrong" }), null);
  assert.equal(authenticate(accounts, { email: "nobody@uni.edu", password: "password123" }), null);
  assert.equal(authenticate(accounts, { email: "ana@uni.edu", password: "password123", role: "advisor" }), null);
});

test("authenticate returns null when there are no saved accounts", () => {
  assert.equal(authenticate([], { email: "ana@uni.edu", password: "password123" }), null);
  assert.equal(authenticate(null, { email: "ana@uni.edu", password: "password123" }), null);
});
