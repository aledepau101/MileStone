"use strict";

// In-memory login sessions. Restarting the server logs everyone out.
const crypto = require("node:crypto");

const SESSION_COOKIE = "sid";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, { userId, expiresAt: Date.now() + SESSION_MAX_AGE_MS });
  return sessionId;
}

function getUserId(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session.userId;
}

function destroySession(sessionId) {
  sessions.delete(sessionId);
}

function parseCookies(header) {
  const cookies = {};
  if (typeof header !== "string") return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

module.exports = {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  createSession,
  getUserId,
  destroySession,
  parseCookies,
};
