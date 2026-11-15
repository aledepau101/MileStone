"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../db");
const { signup, login, toUser } = require("../auth-service");
const {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  createSession,
  destroySession,
  parseCookies,
} = require("../sessions");

const router = express.Router();

function respond(res, result) {
  if (result.userId) {
    res.cookie(SESSION_COOKIE, createSession(result.userId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_MS,
    });
  }
  res.status(result.status).json(result.body);
}

router.post("/signup", async (req, res, next) => {
  try {
    respond(res, await signup(req.body, { prisma, bcrypt }));
  } catch (err) { next(err); }
});

router.post("/login", async (req, res, next) => {
  try {
    respond(res, await login(req.body, { prisma, bcrypt }));
  } catch (err) { next(err); }
});

router.post("/logout", (req, res) => {
  const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (sessionId) destroySession(sessionId);
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

router.get("/me", async (req, res, next) => {
  try {
    const id = req.get("x-user-id");
    const user = id ? await prisma.user.findUnique({ where: { id } }) : null;
    if (!user) return res.status(401).json({ error: "Not logged in." });
    res.json(toUser(user));
  } catch (err) { next(err); }
});

module.exports = router;
