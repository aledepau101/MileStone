const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSignupFields } = require("../js/validation.js");

const validFields = {
  fullName: "Ada Lovelace",
  email: "ada@university.edu",
  password: "analytical8",
  confirmPassword: "analytical8",
};

test("accepts valid sign-up fields", () => {
  assert.deepEqual(validateSignupFields(validFields), {});
});

test("requires a full name", () => {
  assert.deepEqual(validateSignupFields({ ...validFields, fullName: "   " }), {
    fullName: "Full name is required.",
  });
});

test("requires a university email", () => {
  assert.deepEqual(validateSignupFields({ ...validFields, email: "" }), {
    email: "University email is required.",
  });
});

test("rejects an invalid email format", () => {
  assert.deepEqual(validateSignupFields({ ...validFields, email: "ada-at-university" }), {
    email: "Enter a valid email address.",
  });
});

test("requires a password", () => {
  assert.deepEqual(validateSignupFields({ ...validFields, password: "" }), {
    password: "Password is required.",
    confirmPassword: "Passwords do not match.",
  });
});

test("requires a password of at least eight characters", () => {
  assert.deepEqual(validateSignupFields({
    ...validFields,
    password: "short",
    confirmPassword: "short",
  }), {
    password: "Password must be at least 8 characters.",
  });
});

test("requires password confirmation", () => {
  assert.deepEqual(validateSignupFields({ ...validFields, confirmPassword: "" }), {
    confirmPassword: "Please confirm your password.",
  });
});

test("rejects mismatched passwords", () => {
  assert.deepEqual(validateSignupFields({
    ...validFields,
    confirmPassword: "different8",
  }), {
    confirmPassword: "Passwords do not match.",
  });
});

test("returns errors for every missing field", () => {
  assert.deepEqual(validateSignupFields(), {
    fullName: "Full name is required.",
    email: "University email is required.",
    password: "Password is required.",
    confirmPassword: "Please confirm your password.",
  });
});
