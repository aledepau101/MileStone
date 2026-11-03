const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getDateKey,
  isValidDateKey,
  loadPlannerEvents,
  parseEventTime,
  savePlannerEvents,
  validateEvent,
} = require("../js/planner-logic.js");

function createStorage(initialValue = null) {
  return {
    value: initialValue,
    getItem() {
      return this.value;
    },
    setItem(key, value) {
      this.value = value;
    },
  };
}

test("builds date keys from local date components", () => {
  assert.equal(getDateKey(new Date(2026, 10, 3)), "2026-11-03");
});

test("validates real calendar date keys", () => {
  assert.equal(isValidDateKey("2024-02-29"), true);
  assert.equal(isValidDateKey("2025-02-29"), false);
  assert.equal(isValidDateKey("2026-13-01"), false);
  assert.equal(isValidDateKey("2026-1-01"), false);
});

test("parses both time input and saved 12-hour event times", () => {
  assert.deepEqual(parseEventTime("09:30"), { hour: 9, minute: 30 });
  assert.deepEqual(parseEventTime("3:30 PM"), { hour: 15, minute: 30 });
  assert.deepEqual(parseEventTime("12:00 AM"), { hour: 0, minute: 0 });
  assert.deepEqual(parseEventTime("12:00 PM"), { hour: 12, minute: 0 });
  assert.equal(parseEventTime("25:00"), null);
  assert.equal(parseEventTime("13:00 PM"), null);
});

test("validates event title and date", () => {
  assert.deepEqual(validateEvent({ title: "Study group", date: "2026-11-03" }), {});
  assert.deepEqual(validateEvent({ title: "  ", date: "2026-02-30" }), {
    title: "Event title is required.",
    date: "Enter a valid date.",
  });
});

test("loads no events when storage is empty", () => {
  assert.deepEqual(loadPlannerEvents(createStorage()), []);
});

test("falls back to an empty list for invalid JSON or a non-array value", () => {
  assert.deepEqual(loadPlannerEvents(createStorage("{")), []);
  assert.deepEqual(loadPlannerEvents(createStorage(JSON.stringify({ title: "Event" }))), []);
});

test("saves and reloads events", () => {
  const storage = createStorage();
  const events = [{ title: "Exam", date: "2026-11-03", type: "deadline" }];

  savePlannerEvents(events, storage);

  assert.deepEqual(loadPlannerEvents(storage), events);
});

test("rejects non-array event data when saving", () => {
  assert.throws(() => savePlannerEvents({}, createStorage()), TypeError);
});
