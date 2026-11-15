"use strict";

// Temp: replace with the real login middleware once it exists
module.exports = function requireAuth(req, res, next) {
  const id = req.get("x-user-id");
  if (!id) return res.status(401).json({ error: "Not logged in." });
  req.user = { id };
  next();
};