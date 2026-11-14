"use strict";

require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/db");

const DEMO_EMAIL = "demo@milestone.example";
const DEMO_PASSWORD = "MileStoneDemoPass123!";
const DEMO_USER_NAME = "MileStone Demo";
const DEMO_USER_ROLE = "student";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: DEMO_USER_NAME,
      passwordHash,
      role: DEMO_USER_ROLE,
    },
    create: {
      name: DEMO_USER_NAME,
      email: DEMO_EMAIL,
      passwordHash,
      role: DEMO_USER_ROLE,
    },
  });

  const sampleEvents = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Literature review draft",
      date: "2026-11-18",
      endDate: null,
      time: "09:00",
      endTime: "10:00",
      location: "Research Library",
      type: "deadline",
      description: "Complete the first literature review draft.",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      title: "Advisor check-in",
      date: "2026-11-20",
      endDate: null,
      time: "14:00",
      endTime: "14:30",
      location: "Online",
      type: "personal",
      description: "Discuss research progress and next steps.",
    },
  ];

  for (const event of sampleEvents) {
    await prisma.calendarEvent.upsert({
      where: { id: event.id },
      update: {},
      create: {
        ...event,
        userId: demoUser.id,
      },
    });
  }

  console.log("Seeded the demo user and sample calendar events.");
}

main()
  .catch((error) => {
    const errorCode = typeof error?.code === "string" ? error.code : "unknown";
    console.error(`Database seed failed (${errorCode}). Check DATABASE_URL and database availability.`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
