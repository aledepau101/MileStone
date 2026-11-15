"use strict";

// Signup and login logic. Dependencies are passed in so this can be tested without a database.
const { validateSignupFields, validateLoginFields } = require("../js/validation");

const ROLES = ["student", "advisor"];

const toUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

async function signup(body, { prisma, bcrypt }) {
  const { name, email, password, role } = body ?? {};

  const errors = validateSignupFields({
    fullName: name,
    email,
    password,
    confirmPassword: password,
  });
  delete errors.confirmPassword;

  if (!errors.fullName && name.trim().length > 100) {
    errors.fullName = "Full name must be 100 characters or fewer.";
  }
  if (!errors.email && email.trim().length > 255) {
    errors.email = "Email must be 255 characters or fewer.";
  }
  if (!errors.password && password.length > 72) {
    errors.password = "Password must be 72 characters or fewer.";
  }
  if (!ROLES.includes(role)) {
    errors.role = "Choose student or advisor.";
  }
  if (Object.keys(errors).length > 0) {
    return { status: 400, body: { errors } };
  }

  const duplicate = { status: 409, body: { errors: { email: "This email is already registered." } } };
  const normalizedEmail = normalizeEmail(email);

  if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
    return duplicate;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash, role },
    });
    return { status: 201, body: toUser(user), userId: user.id };
  } catch (error) {
    if (error?.code === "P2002") return duplicate;
    throw error;
  }
}

async function login(body, { prisma, bcrypt }) {
  const { email, password, role } = body ?? {};

  const errors = validateLoginFields({ email, password });
  if (Object.keys(errors).length > 0) {
    return { status: 400, body: { errors } };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  const matches =
    user &&
    (await bcrypt.compare(password, user.passwordHash)) &&
    (!role || user.role === role);

  if (!matches) {
    return { status: 401, body: { error: "Incorrect email, password, or account type." } };
  }

  return { status: 200, body: toUser(user), userId: user.id };
}

module.exports = { signup, login, toUser, normalizeEmail };
