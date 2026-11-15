"use strict";

const { SESSION_COOKIE, getUserId, parseCookies } = require("../sessions");

// Turns the login cookie into the x-user-id header that requireAuth already trusts.
// Any x-user-id sent by the browser is thrown away first, so it can't be faked.
module.exports = function sessionToUser(req, _res, next) {
  delete req.headers["x-user-id"];

  const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const userId = sessionId ? getUserId(sessionId) : null;
  if (userId) {
    req.headers["x-user-id"] = userId;
  }

  next();
};
