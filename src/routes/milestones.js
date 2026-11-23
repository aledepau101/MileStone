"use strict";

const express = require("express");
const prisma = require("../db");
const { isValidDateKey } = require("../../js/planner-logic");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const getUserId = (req) => req.user.id;

function getMilestoneInput(body) {
  const source = body && typeof body === "object" && !Array.isArray(body)
    ? body
    : {};
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const targetDate = source.targetDate;
  const errors = {};

  if (!name) {
    errors.name = "Milestone name is required.";
  } else if (Array.from(name).length > 200) {
    errors.name = "Milestone name must be 200 characters or fewer.";
  }

  if (!isValidDateKey(targetDate)) {
    errors.targetDate = "Enter a valid target date.";
  }

  return { name, targetDate, errors };
}

const toClientMilestone = (milestone) => ({
  id: milestone.id,
  name: milestone.name,
  targetDate: milestone.targetDate,
});

function logAndRespondWithServerError(res, error) {
  console.error("Milestone API request failed.", error);
  return res.status(500).json({ error: "An unexpected error occurred." });
}

router.post("/", async (req, res) => {
  try {
    const input = getMilestoneInput(req.body);
    if (Object.keys(input.errors).length) {
      return res.status(400).json({ errors: input.errors });
    }

    const project = await prisma.thesisProject.findUnique({
      where: { userId: getUserId(req) },
      select: { id: true, finalDeadline: true },
    });
    if (!project) {
      return res.status(400).json({
        error: "Set a thesis final deadline before adding milestones.",
      });
    }
    if (input.targetDate > project.finalDeadline) {
      return res.status(400).json({
        errors: { targetDate: "Target date must be on or before the final deadline." },
      });
    }

    const milestone = await prisma.milestone.create({
      data: {
        thesisProjectId: project.id,
        name: input.name,
        targetDate: input.targetDate,
      },
    });
    res.status(201).json(toClientMilestone(milestone));
  } catch (error) {
    logAndRespondWithServerError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const project = await prisma.thesisProject.findUnique({
      where: { userId: getUserId(req) },
      select: { id: true, finalDeadline: true },
    });
    if (!project) {
      return res.status(404).json({ error: "Milestone not found." });
    }

    const existing = await prisma.milestone.findFirst({
      where: { id: req.params.id, thesisProjectId: project.id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Milestone not found." });
    }

    const input = getMilestoneInput(req.body);
    if (Object.keys(input.errors).length) {
      return res.status(400).json({ errors: input.errors });
    }
    if (input.targetDate > project.finalDeadline) {
      return res.status(400).json({
        errors: { targetDate: "Target date must be on or before the final deadline." },
      });
    }

    const result = await prisma.milestone.updateMany({
      where: { id: req.params.id, thesisProjectId: project.id },
      data: { name: input.name, targetDate: input.targetDate },
    });
    if (!result.count) {
      return res.status(404).json({ error: "Milestone not found." });
    }

    const updated = await prisma.milestone.findFirst({
      where: { id: req.params.id, thesisProjectId: project.id },
    });
    if (!updated) {
      return res.status(404).json({ error: "Milestone not found." });
    }
    res.json(toClientMilestone(updated));
  } catch (error) {
    logAndRespondWithServerError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const project = await prisma.thesisProject.findUnique({
      where: { userId: getUserId(req) },
      select: { id: true },
    });
    if (!project) {
      return res.status(404).json({ error: "Milestone not found." });
    }

    const result = await prisma.milestone.deleteMany({
      where: { id: req.params.id, thesisProjectId: project.id },
    });
    if (!result.count) {
      return res.status(404).json({ error: "Milestone not found." });
    }
    res.status(204).end();
  } catch (error) {
    logAndRespondWithServerError(res, error);
  }
});

module.exports = router;
