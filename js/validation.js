const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function validateSignupFields(fields = {}) {
  const {
    fullName,
    email,
    password,
    confirmPassword,
  } = fields ?? {};
  const errors = {};

  if (isBlank(fullName)) {
    errors.fullName = "Full name is required.";
  }

  if (isBlank(email)) {
    errors.email = "University email is required.";
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (isBlank(password)) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (isBlank(confirmPassword)) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function validateLoginFields(fields = {}) {
  const { email, password } = fields ?? {};
  const errors = {};

  if (isBlank(email)) {
    errors.email = "University email is required.";
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (isBlank(password)) {
    errors.password = "Password is required.";
  }

  return errors;
}

const validationExports = { validateSignupFields, validateLoginFields };

if (typeof module === "object" && module.exports) {
  module.exports = validationExports;
}

if (typeof globalThis === "object") {
  globalThis.validateSignupFields = validateSignupFields;
  globalThis.validateLoginFields = validateLoginFields;
}
