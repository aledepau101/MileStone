"use strict";

const express = require("express");
const prisma = require("../db");
const { validateEvent } = require("../../js/planner-logic");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const getUserId = (req) => req.user.id;
const TYPES = ["deadline", "personal"];

// Only copy the fields we allow, so clients can't set id or userId.
function pickEvent(body = {}) {
  return {
    title: typeof body.title === "string" ? body.title.trim() : "",
    date: body.date,
    endDate: body.endDate || body.date,
    time: body.time || null,
    endTime: body.endTime || null,
    location: typeof body.location === "string" ? body.location.trim() || null : null,
    type: body.type || "personal",
    description: typeof body.description === "string" ? body.description.trim() || null : null,
  };
}

function check(event) {
  const errors = validateEvent(event);
  if (event.title.length > 200) errors.title = "Title must be 200 characters or fewer.";
  if (event.location && event.location.length > 200) errors.location = "Location must be 200 characters or fewer.";
  if (!TYPES.includes(event.type)) errors.type = "Type must be deadline or personal.";
  return errors;
}

const toClient = (row) => ({
  id: row.id,
  title: row.title,
  date: row.date,
  endDate: row.endDate || row.date,
  time: row.time || "",
  endTime: row.endTime || "",
  location: row.location || "",
  type: row.type || "personal",
  description: row.description || "",
});

router.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.calendarEvent.findMany({
      where: { userId: getUserId(req) },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
    res.json(rows.map(toClient));
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const event = pickEvent(req.body);
    const errors = check(event);
    if (Object.keys(errors).length) return res.status(400).json({ errors });
    const row = await prisma.calendarEvent.create({
      data: { ...event, userId: getUserId(req) },
    });
    res.status(201).json(toClient(row));
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const event = pickEvent(req.body);
    const errors = check(event);
    if (Object.keys(errors).length) return res.status(400).json({ errors });
    const userId = getUserId(req);
    const { count } = await prisma.calendarEvent.updateMany({
      where: { id: req.params.id, userId },
      data: event,
    });
    if (!count) return res.status(404).json({ error: "Event not found." });
    const row = await prisma.calendarEvent.findFirst({ where: { id: req.params.id, userId } });
    res.json(toClient(row));
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { count } = await prisma.calendarEvent.deleteMany({
      where: { id: req.params.id, userId: getUserId(req) },
    });
    if (!count) return res.status(404).json({ error: "Event not found." });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;