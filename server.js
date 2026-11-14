"use strict";

require("dotenv").config();

const express = require("express");
const path = require("node:path");
const prisma = require("./src/db");

const app = express();
const projectRoot = __dirname;
const publicPages = new Set([
  "login.html",
  "signup.html",
  "dashboard.html",
  "schedule-planner.html",
]);

app.get("/", (_request, response) => {
  response.redirect(302, "/login.html");
});

app.use("/css", express.static(path.join(projectRoot, "css"), {
  dotfiles: "deny",
  index: false,
}));
app.use("/js", express.static(path.join(projectRoot, "js"), {
  dotfiles: "deny",
  index: false,
}));

app.get("/:page", (request, response, next) => {
  if (!publicPages.has(request.params.page)) {
    next();
    return;
  }

  response.sendFile(path.join(projectRoot, request.params.page));
});

app.get("/api/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();
    response.json({ status: "ok", userCount });
  } catch {
    console.error("Database health check failed.");
    response.status(500).json({
      status: "error",
      error: "Database health check failed.",
    });
  }
});

module.exports = app;

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`MileStone server listening on port ${port}.`);
  });
}
