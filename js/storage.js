const ACCOUNTS_STORAGE_KEY = "accounts";

async function getAccounts() {
  let storedAccounts;

  try {
    storedAccounts = globalThis.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
  } catch (error) {
    throw new Error("Unable to read accounts from localStorage.", { cause: error });
  }

  if (storedAccounts === null) {
    return [];
  }

  let accounts;
  try {
    accounts = JSON.parse(storedAccounts);
  } catch (error) {
    throw new Error("Stored accounts contain invalid JSON.", { cause: error });
  }

  if (!Array.isArray(accounts)) {
    throw new Error("Stored accounts must be an array.");
  }

  return accounts;
}

async function createAccount(account) {
  if (
    account === null ||
    typeof account !== "object" ||
    typeof account.name !== "string" ||
    typeof account.email !== "string" ||
    typeof account.password !== "string" ||
    typeof account.role !== "string" ||
    !account.email.trim()
  ) {
    return { ok: false, error: "Account must include a name, email, password, and role." };
  }

  try {
    const accounts = await getAccounts();
    const normalizedEmail = account.email.trim().toLowerCase();

    if (accounts.some(
      (savedAccount) =>
        typeof savedAccount?.email === "string" &&
        savedAccount.email.trim().toLowerCase() === normalizedEmail,
    )) {
      return { ok: false, error: "This email is already registered." };
    }

    accounts.push({
      name: account.name,
      email: account.email.trim(),
      password: account.password,
      role: account.role,
    });

    globalThis.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to save account.",
    };
  }
}

module.exports = { getAccounts, createAccount };