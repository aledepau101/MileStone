"use strict";

const express = require("express");
const prisma = require("../db");
const { isValidDateKey } = require("../../js/planner-logic");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const getUserId = (req) => req.user.id;

function getTaskInput(body) {
  const source = body && typeof body === "object" && !Array.isArray(body)
    ? body
    : {};
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const dueDate = source.dueDate;
  const milestoneId = typeof source.milestoneId === "string"
    ? source.milestoneId.trim()
    : "";
  const errors = {};

  if (!name) {
    errors.name = "Task name is required.";
  } else if (Array.from(name).length > 200) {
    errors.name = "Task name must be 200 characters or fewer.";
  }

  if (!isValidDateKey(dueDate)) {
    errors.dueDate = "Enter a valid due date.";
  }

  if (!milestoneId) {
    errors.milestoneId = "Choose a milestone.";
  }

  return { name, dueDate, milestoneId, errors };
}

function taskOwnershipFilter(userId) {
  return {
    milestone: {
      is: {
        thesisProject: {
          is: { userId },
        },
      },
    },
  };
}

const taskInclude = {
  milestone: {
    select: { id: true, name: true, targetDate: true },
  },
};

const toClientTask = (task) => ({
  id: task.id,
  name: task.name,
  dueDate: task.dueDate,
  completed: task.completed,
  milestoneId: task.milestoneId,
  milestone: task.milestone,
});

function logAndRespondWithServerError(res, error) {
  console.error("Tasks API request failed.", error);
  return res.status(500).json({ error: "An unexpected error occurred." });
}

router.get("/", async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: taskOwnershipFilter(getUserId(req)),
      include: taskInclude,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    });

    res.json(tasks.map(toClientTask));
  } catch (error) {
    logAndRespondWithServerError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const input = getTaskInput(req.body);
    if (Object.keys(input.errors).length) {
      return res.status(400).json({ errors: input.errors });
    }

    const milestone = await prisma.milestone.findFirst({
      where: {
        id: input.milestoneId,
        thesisProject: {
          is: { userId: getUserId(req) },
        },
      },
      select: { id: true },
    });

    if (!milestone) {
      return res.status(404).json({ error: "Milestone not found." });
    }

    const task = await prisma.task.create({
      data: {
        name: input.name,
        dueDate: input.dueDate,
        milestoneId: milestone.id,
      },
      include: taskInclude,
    });

    res.status(201).json(toClientTask(task));
  } catch (error) {
    logAndRespondWithServerError(res, error);
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};

    if (typeof body.completed !== "boolean") {
      return res.status(400).json({
        errors: { completed: "Completion status must be true or false." },
      });
    }

    const where = {
      id: req.params.id,
      ...taskOwnershipFilter(getUserId(req)),
    };
    const result = await prisma.task.updateMany({
      where,
      data: { completed: body.completed },
    });

    if (!result.count) {
      return res.status(404).json({ error: "Task not found." });
    }

    const task = await prisma.task.findFirst({
      where,
      include: taskInclude,
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    res.json(toClientTask(task));
  } catch (error) {
    logAndRespondWithServerError(res, error);
  }
});

module.exports = router;
