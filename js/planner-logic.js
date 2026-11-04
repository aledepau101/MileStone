"use strict";

const PLANNER_EVENTS_STORAGE_KEY = "plannerEvents";

function isValidDateKey(dateKey) {
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return false;
    }

    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

function getDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new TypeError("A valid Date is required.");
    }

    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
}

function parseEventTime(time) {
    if (typeof time !== "string") {
        return null;
    }

    const normalizedTime = time.trim();
    const twentyFourHourMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalizedTime);
    if (twentyFourHourMatch) {
        return {
            hour: Number(twentyFourHourMatch[1]),
            minute: Number(twentyFourHourMatch[2]),
        };
    }

    const twelveHourMatch = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i.exec(normalizedTime);
    if (!twelveHourMatch) {
        return null;
    }

    const period = twelveHourMatch[3].toUpperCase();
    const hour = Number(twelveHourMatch[1]) % 12 + (period === "PM" ? 12 : 0);

    return {
        hour,
        minute: Number(twelveHourMatch[2]),
    };
}

function getEventEndDate(event) {
    // Older saved events do not have an end date and remain single-day events.
    return event?.endDate || event?.date;
}

function validateEvent(event = {}) {
    const errors = {};

    if (
        event === null ||
        typeof event !== "object" ||
        typeof event.title !== "string" ||
        event.title.trim() === ""
    ) {
        errors.title = "Event title is required.";
    }

    const hasValidStartDate = isValidDateKey(event?.date);
    if (!hasValidStartDate) {
        errors.date = "Enter a valid date.";
    }

    const endDate = getEventEndDate(event);
    const hasValidEndDate = isValidDateKey(endDate);
    if (!hasValidEndDate) {
        errors.endDate = "Enter a valid end date.";
    } else if (hasValidStartDate && endDate < event.date) {
        errors.endDate = "End date must be on or after the start date.";
    }

    const startTime = event?.time ? parseEventTime(event.time) : null;
    const endTime = event?.endTime ? parseEventTime(event.endTime) : null;
    if (event?.time && !startTime) {
        errors.time = "Enter a valid start time.";
    }
    if (event?.endTime && !endTime) {
        errors.endTime = "Enter a valid end time.";
    } else if (endTime && !startTime) {
        errors.endTime = "Enter a start time before the end time.";
    } else if (
        startTime &&
        endTime &&
        hasValidStartDate &&
        hasValidEndDate &&
        event.date === endDate &&
        endTime.hour * 60 + endTime.minute <= startTime.hour * 60 + startTime.minute
    ) {
        errors.endTime = "End time must be after the start time.";
    }

    return errors;
}

function loadPlannerEvents(storage = globalThis.localStorage) {
    let serializedEvents;

    try {
        serializedEvents = storage.getItem(PLANNER_EVENTS_STORAGE_KEY);
    } catch (error) {
        throw new Error("Unable to read planner events from localStorage.", {
            cause: error,
        });
    }

    if (serializedEvents === null) {
        return [];
    }

    try {
        const events = JSON.parse(serializedEvents);
        return Array.isArray(events) ? events : [];
    } catch {
        return [];
    }
}

function savePlannerEvents(events, storage = globalThis.localStorage) {
    if (!Array.isArray(events)) {
        throw new TypeError("Planner events must be an array.");
    }

    try {
        storage.setItem(PLANNER_EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
        throw new Error("Unable to save planner events to localStorage.", {
            cause: error,
        });
    }
}

const plannerLogicExports = {
    getDateKey,
    getEventEndDate,
    isValidDateKey,
    loadPlannerEvents,
    parseEventTime,
    savePlannerEvents,
    validateEvent,
};

if (typeof module === "object" && module.exports) {
    module.exports = plannerLogicExports;
}

if (typeof globalThis === "object") {
    globalThis.plannerLogic = plannerLogicExports;
}
