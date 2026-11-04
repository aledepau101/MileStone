// Simulated authentication: compares credentials against accounts saved in localStorage.
// Returns the session object ({ name, email, role }, no password) or null.
function authenticate(accounts, credentials = {}) {
  const { email, password, role } = credentials ?? {};

  if (!Array.isArray(accounts) || typeof email !== "string" || typeof password !== "string") {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const match = accounts.find(
    (account) =>
      typeof account?.email === "string" &&
      account.email.trim().toLowerCase() === normalizedEmail &&
      account.password === password &&
      (!role || account.role === role),
  );

  return match ? { name: match.name, email: match.email, role: match.role } : null;
}

const authExports = { authenticate };

if (typeof module === "object" && module.exports) {
  module.exports = authExports;
}

if (typeof globalThis === "object") {
  globalThis.authenticate = authenticate;
}
