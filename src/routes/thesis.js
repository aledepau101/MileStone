"use strict";

const express = require("express");
const prisma = require("../db");
const { isValidDateKey } = require("../../js/planner-logic");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const getUserId = (req) => req.user.id;

const toClientMilestone = (milestone) => ({
  id: milestone.id,
  name: milestone.name,
  targetDate: milestone.targetDate,
});

function getDeadline(body) {
  return body && typeof body === "object" && !Array.isArray(body)
    ? body.finalDeadline
    : undefined;
}

function logAndRespondWithServerError(res, error) {
  console.error("Thesis API request failed.", error);
  return res.status(500).json({ error: "An unexpected error occurred." });
}

router.get("/", async (req, res) => {
  try {
    const project = await prisma.thesisProject.findUnique({
      where: { userId: getUserId(req) },
      include: {
        milestones: {
          orderBy: [{ targetDate: "asc" }, { id: "asc" }],
        },
      },
    });

    res.json({
      finalDeadline: project ? project.finalDeadline : null,
      milestones: project ? project.milestones.map(toClientMilestone) : [],
    });
  } catch (error) {
    logAndRespondWithServerError(res, error);
  }
});

router.put("/deadline", async (req, res) => {
  try {
    const finalDeadline = getDeadline(req.body);
    if (!isValidDateKey(finalDeadline)) {
      return res.status(400).json({
        errors: { finalDeadline: "Enter a valid final deadline." },
      });
    }

    const userId = getUserId(req);
    const project = await prisma.thesisProject.findUnique({
      where: { userId },
      include: {
        milestones: {
          where: { targetDate: { gt: finalDeadline } },
          orderBy: [{ targetDate: "asc" }, { id: "asc" }],
        },
      },
    });

    if (project && project.milestones.length) {
      return res.status(400).json({
        error: "The final deadline cannot be earlier than these milestones.",
        conflicts: project.milestones.map(toClientMilestone),
      });
    }

    const updatedProject = await prisma.thesisProject.upsert({
      where: { userId },
      create: { userId, finalDeadline },
      update: { finalDeadline },
      select: { finalDeadline: true },
    });

    res.json({ finalDeadline: updatedProject.finalDeadline });
  } catch (error) {
    logAndRespondWithServerError(res, error);
  }
});

module.exports = router;
