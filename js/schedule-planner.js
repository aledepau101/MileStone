"use strict";

// Schedule Planner calendar navigation and display

const calendarGrid = document.getElementById("calendar-grid");
const calendarTitle = document.getElementById("calendar-title");

const monthButton = document.getElementById("month-view-btn");
const weekButton = document.getElementById("week-view-btn");

const previousButton = document.getElementById("previous-btn");
const nextButton = document.getElementById("next-btn");
const todayButton = document.getElementById("today-btn");

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let currentDate = new Date();
let currentView = "month";
let plannerEvents = [];
let editingEventIndex = null;

// Convert JS Sunday-first numbering to Monday-first.
function getMonday(date) {
    const monday = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    const day = monday.getDay();
    const difference = (day + 6) % 7;

    monday.setDate(monday.getDate() - difference);
    return monday;
}

// Display the monthly calendar.
function renderMonth() {
    calendarGrid.innerHTML = "";

    calendarTitle.textContent = currentDate.toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric" }
    );

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = getMonday(firstDay);

    const lastDay = new Date(year, month + 1, 0);
    const lastWeekStart = getMonday(lastDay);

    const totalDays =
        Math.round(
            (Date.UTC(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate()) -
        Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) / 86400000
        ) + 7;
    const today = new Date();

        const weekdayRow = document.createElement("div");
        weekdayRow.className = "month-weekday-row";
        dayNames.forEach((day) => {
            const heading = document.createElement("div");
            heading.className = "calendar-day-header";
            heading.textContent = day;
            weekdayRow.appendChild(heading);
        });
        calendarGrid.appendChild(weekdayRow);

        for (let week = 0; week < totalDays / 7; week++) {
            const weekRow = document.createElement("div");
            weekRow.className = "month-week-row";
            weekRow.dataset.weekStart = plannerLogic.getDateKey(new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate() + week * 7
            ));

            for (let day = 0; day < 7; day++) {
                const date = new Date(
                    startDate.getFullYear(),
                    startDate.getMonth(),
                    startDate.getDate() + week * 7 + day
                );
                const dayCell = document.createElement("div");
                dayCell.className = "calendar-day";
                dayCell.dataset.date = plannerLogic.getDateKey(date);

                const dateLabel = document.createElement("span");
                dateLabel.className = "calendar-day-number";
                dateLabel.textContent = String(date.getDate());
                dayCell.appendChild(dateLabel);

                if (date.getMonth() !== month) {
                    dayCell.classList.add("other-month");
                }
                if (
                    date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate()
                ) {
                    dayCell.classList.add("today");
                }

                weekRow.appendChild(dayCell);
            }

            // Keep the spanning event layer separate so it cannot move date cells.
            const eventOverlay = document.createElement("div");
            eventOverlay.className = "month-event-overlay";
            weekRow.appendChild(eventOverlay);
            calendarGrid.appendChild(weekRow);
        }

        calendarGrid.classList.remove("week-view");
}
// Display the weekly calendar with hourly rows.
function renderWeek() {
    calendarGrid.innerHTML = "";

    const monday = getMonday(currentDate);
    const sunday = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + 6
    );

    const dateFormat = {
        month: "short",
        day: "numeric"
    };

    calendarTitle.textContent =
        monday.toLocaleDateString("en-US", dateFormat) +
        " - " +
        sunday.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });

    // Use a dedicated grid layout for the hourly week view.
    calendarGrid.classList.add("week-view");

    const corner = document.createElement("div");
    corner.className = "calendar-day-header";
    corner.style.gridColumn = "1";
    corner.style.gridRow = "1";
    calendarGrid.appendChild(corner);

    for (let i = 0; i < 7; i++) {
        const date = new Date(
            monday.getFullYear(),
            monday.getMonth(),
            monday.getDate() + i
        );

        const heading = document.createElement("div");
        heading.className = "calendar-day-header";
        heading.textContent = dayNames[i] + " " + date.getDate();
        heading.style.gridColumn = String(i + 2);
        heading.style.gridRow = "1";

        calendarGrid.appendChild(heading);
    }

    const allDayLabel = document.createElement("div");
    allDayLabel.className = "week-time-label";
    allDayLabel.textContent = "All day";
    allDayLabel.style.gridColumn = "1";
    allDayLabel.style.gridRow = "2";
    calendarGrid.appendChild(allDayLabel);

    for (let day = 0; day < 7; day++) {
        const date = new Date(
            monday.getFullYear(),
            monday.getMonth(),
            monday.getDate() + day
        );
        const cell = document.createElement("div");
        cell.className = "week-all-day-cell";
        cell.dataset.date = plannerLogic.getDateKey(date);
        cell.dataset.day = String(day);
        cell.style.gridColumn = String(day + 2);
        cell.style.gridRow = "2";
        calendarGrid.appendChild(cell);
    }

    // Hourly rows from 12 AM through 11 PM.
    for (let hour = 0; hour <= 24; hour++) {
        const timeLabel = document.createElement("div");
        timeLabel.className = "week-time-label";
        timeLabel.style.gridColumn = "1";
        timeLabel.style.gridRow = String(hour + 3);

        const displayHour = hour % 12 || 12;
        const period = hour < 12 || hour === 24 ? "AM" : "PM";

        timeLabel.textContent = displayHour + " " + period;
        calendarGrid.appendChild(timeLabel);

        for (let day = 0; day < 7; day++) {
            const cell = document.createElement("div");
            cell.className = "week-hour-cell";
            cell.dataset.hour = String(hour);
            cell.dataset.day = String(day);
            cell.style.gridColumn = String(day + 2);
            cell.style.gridRow = String(hour + 3);
            cell.dataset.date = plannerLogic.getDateKey(new Date(
                monday.getFullYear(),
                monday.getMonth(),
                monday.getDate() + day
            ));

            calendarGrid.appendChild(cell);
        }
    }
}

function formatEventTime(time) {
    const parsedTime = plannerLogic.parseEventTime(time);
    if (!parsedTime) {
        return "";
    }

    const { hour, minute } = parsedTime;
    const displayHour = hour % 12 || 12;
    const period = hour < 12 ? "AM" : "PM";

    return displayHour + ":" + String(minute).padStart(2, "0") + " " + period;
}

function createEventElement(event, eventIndex, options = {}) {
    const eventElement = document.createElement("button");
    eventElement.type = "button";
    eventElement.className = "calendar-event";
    eventElement.dataset.eventIndex = String(eventIndex);
    eventElement.setAttribute(
        "aria-label",
        "View event: " + event.title + ", " + formatEventDateRange(event) +
        (formatEventTimeRange(event) ? ", " + formatEventTimeRange(event) : "")
    );

    if (event.type === "deadline" || event.type === "personal") {
        eventElement.classList.add(event.type);
    }

    const title = document.createElement("span");
    title.className = "calendar-event-title";
    title.textContent = event.title;
    eventElement.appendChild(title);

    const time = options.timeLabel === undefined
        ? formatEventTime(event.time)
        : options.timeLabel;
    if (time) {
        const timeElement = document.createElement("span");
        timeElement.className = "calendar-event-time";
        timeElement.textContent = time;
        eventElement.appendChild(timeElement);
    }

    return eventElement;
}

function getDateOffset(startDate, dateKey) {
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [year, month, day] = dateKey.split("-").map(Number);
    return Math.round((
        Date.UTC(year, month - 1, day) -
        Date.UTC(startYear, startMonth - 1, startDay)
    ) / 86400000);
}

function getEventDayRange(event, dateKey) {
    const startDate = event.date;
    const endDate = plannerLogic.getEventEndDate(event);
    const startTime = plannerLogic.parseEventTime(event.time);
    const endTime = plannerLogic.parseEventTime(event.endTime);

    if (!startTime && !endTime) {
        return null;
    }

    const isStartDate = dateKey === startDate;
    const isEndDate = dateKey === endDate;
    const startMinute = isStartDate && startTime
        ? startTime.hour * 60 + startTime.minute
        : 0;
    let endMinute = isEndDate && endTime
        ? endTime.hour * 60 + endTime.minute
        : 1440;

    // Keep legacy single-time events visible as a one-hour block.
    if (isStartDate && isEndDate && startTime && !endTime) {
        endMinute = Math.min(startMinute + 60, 1440);
    }

    return { startMinute, endMinute, isStartDate, isEndDate };
}

function renderEvents() {
    const validEvents = plannerEvents
        .map((event, index) => ({ event, index }))
        .filter(({ event }) =>
            Object.keys(plannerLogic.validateEvent(event)).length === 0
        );

    if (currentView === "month") {
        const weekRows = calendarGrid.querySelectorAll(".month-week-row");
        weekRows.forEach((weekRow) => {
            const weekStart = weekRow.dataset.weekStart;
            const weekEnd = plannerLogic.getDateKey(new Date(
                Number(weekStart.slice(0, 4)),
                Number(weekStart.slice(5, 7)) - 1,
                Number(weekStart.slice(8, 10)) + 6
            ));

            validEvents.forEach(({ event, index }) => {
                const eventEndDate = plannerLogic.getEventEndDate(event);
                if (event.date > weekEnd || eventEndDate < weekStart) {
                    return;
                }

                // Split long events at week boundaries so no segment escapes the month grid.
                const startColumn = Math.max(0, getDateOffset(weekStart, event.date));
                const endColumn = Math.min(6, getDateOffset(weekStart, eventEndDate));
                const eventElement = createEventElement(event, index, {
                    timeLabel: formatCompactEventTimeRange(event),
                });
                eventElement.classList.add("month-range-event");
                eventElement.style.gridColumn =
                    (startColumn + 1) + " / " + (endColumn + 2);
                eventElement.style.gridRow = "1";
                weekRow.querySelector(".month-event-overlay").appendChild(eventElement);
            });
        });
        return;
    }

    const monday = getMonday(currentDate);
    const weekStart = plannerLogic.getDateKey(monday);

    validEvents.forEach(({ event, index }) => {
        const endDate = plannerLogic.getEventEndDate(event);
        const startOffset = Math.max(0, getDateOffset(weekStart, event.date));
        const endOffset = Math.min(6, getDateOffset(weekStart, endDate));
        if (startOffset > endOffset || endDate < weekStart) {
            return;
        }

        if (!event.time && !event.endTime) {
            const eventElement = createEventElement(event, index);
            eventElement.classList.add("week-all-day-event");
            eventElement.style.gridColumn =
                (startOffset + 2) + " / " + (endOffset + 3);
            eventElement.style.gridRow = "2";
            calendarGrid.appendChild(eventElement);
            return;
        }

        for (let dayOffset = startOffset; dayOffset <= endOffset; dayOffset++) {
            const dateKey = plannerLogic.getDateKey(new Date(
                monday.getFullYear(),
                monday.getMonth(),
                monday.getDate() + dayOffset
            ));
            const range = getEventDayRange(event, dateKey);
            if (!range || range.endMinute <= range.startMinute) {
                continue;
            }

            const startHour = Math.floor(range.startMinute / 60);
            const endHour = Math.ceil(range.endMinute / 60);
            const eventElement = createEventElement(event, index, {
                timeLabel: range.isStartDate && range.isEndDate
                    ? formatCompactEventTimeRange(event)
                    : range.isStartDate
                        ? formatEventTime(event.time)
                        : range.isEndDate
                            ? formatEventTime(event.endTime) || "End of day"
                            : "",
            });
            eventElement.classList.add("week-timed-event");
            eventElement.style.gridColumn = String(dayOffset + 2);
            eventElement.style.gridRow =
                (startHour + 3) + " / " + (endHour + 3);
            eventElement.style.marginTop =
                (range.startMinute % 60) / 60 * 55 + "px";
            eventElement.style.marginBottom =
                (range.endMinute % 60 === 0
                    ? 0
                    : (60 - range.endMinute % 60) / 60 * 55) + "px";
            calendarGrid.appendChild(eventElement);
        }
    });
}

// Refresh the selected calendar view.
function renderCalendar() {
    calendarGrid.classList.toggle("week-view", currentView === "week");

    if (currentView === "month") {
        renderMonth();
    } else {
        renderWeek();
    }
    
    monthButton.classList.toggle(
        "selected",
        currentView === "month"
    );

    weekButton.classList.toggle(
        "selected",
        currentView === "week"
    );

    monthButton.setAttribute(
        "aria-pressed",
        String(currentView === "month")
    );

    weekButton.setAttribute(
        "aria-pressed",
        String(currentView === "week")
    );

    renderEvents();
}

// Switch to Month view.
monthButton.addEventListener("click", () => {
    currentView = "month";
    renderCalendar();
});

// Switch to Week view.
weekButton.addEventListener("click", () => {
    currentView = "week";
    renderCalendar();
});

// Move to the previous month or week.
previousButton.addEventListener("click", () => {
    if (currentView === "month") {
        currentDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() - 1,
            1
        );
    } else {
        currentDate.setDate(currentDate.getDate() - 7);
    }

    renderCalendar();
});

// Move to the next month or week.
nextButton.addEventListener("click", () => {
    if (currentView === "month") {
        currentDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            1
        );
    } else {
        currentDate.setDate(currentDate.getDate() + 7);
    }

    renderCalendar();
});

// Return to today's date.
todayButton.addEventListener("click", () => {
    currentDate = new Date();
    renderCalendar();
});

// Display the calendar when the page loads.
renderCalendar();

function setPlannerFieldError(input, errorElement, message) {
    errorElement.textContent = message || "";

    if (message) {
        input.setAttribute("aria-invalid", "true");
    } else {
        input.removeAttribute("aria-invalid");
    }
}

function clearPlannerFormErrors() {
    setPlannerFieldError(
        document.getElementById("event-title"),
        document.getElementById("title-error"),
        ""
    );
    setPlannerFieldError(
        document.getElementById("event-date"),
        document.getElementById("date-error"),
        ""
    );
    setPlannerFieldError(
        document.getElementById("event-end-date"),
        document.getElementById("end-date-error"),
        ""
    );
    setPlannerFieldError(
        document.getElementById("event-time"),
        document.getElementById("time-error"),
        ""
    );
    setPlannerFieldError(
        document.getElementById("event-end-time"),
        document.getElementById("end-time-error"),
        ""
    );
    document.getElementById("event-error").textContent = "";
}

function resetEventForm() {
    const form = document.getElementById("event-form");
    editingEventIndex = null;
    form.reset();
    clearPlannerFormErrors();
    document.getElementById("event-heading").textContent = "Add New Event";
    document.getElementById("event-submit").textContent = "Add Event";
    document.getElementById("cancel-edit").hidden = true;
}

function formatEventDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function formatEventDateRange(event) {
    const endDate = plannerLogic.getEventEndDate(event);
    const start = formatEventDate(event.date);
    return endDate === event.date
        ? start
        : start + " - " + formatEventDate(endDate);
}

function formatEventTimeRange(event) {
    if (!event.time) {
        return "";
    }

    const start = formatEventTime(event.time);
    const end = formatEventTime(event.endTime);
    if (end) {
        return start + " - " + end;
    }

    if (plannerLogic.getEventEndDate(event) !== event.date) {
        return start + " - End of day";
    }

    const parsedStart = plannerLogic.parseEventTime(event.time);
    const endMinute = Math.min(parsedStart.hour * 60 + parsedStart.minute + 60, 1440);
    if (endMinute === 1440) {
        return start + " - End of day";
    }

    return start + " - " + formatEventTime(
        String(Math.floor(endMinute / 60)).padStart(2, "0") + ":" +
        String(endMinute % 60).padStart(2, "0")
    );
}

function formatCompactEventTimeRange(event) {
    return formatEventTimeRange(event)
        .replace(/\s*(AM|PM)\b/g, (period) => period.trim()[0].toLowerCase())
        .replace(/\s+-\s+/g, "-");
}

function showEventDetails(eventIndex) {
    const event = plannerEvents[eventIndex];
    if (!event) {
        return;
    }

    document.getElementById("event-details-title").textContent = event.title;
    document.getElementById("event-details-date").textContent =
        formatEventDateRange(event);
    document.getElementById("event-details-time").textContent =
        formatEventTimeRange(event) || "All day";
    document.getElementById("event-details-location").textContent =
        event.location || "Not specified";
    document.getElementById("event-details-type").textContent =
        event.type === "personal"
            ? "Personal"
            : event.type === "deadline"
                ? "Deadline"
                : "Not specified";
    document.getElementById("event-details-description").textContent =
        event.description || "No description";
    document.getElementById("event-dialog-error").textContent = "";
    document.getElementById("event-details-dialog").showModal();
}

function beginEventEdit() {
    const eventIndex = Number(
        document.getElementById("event-details-dialog").dataset.eventIndex
    );
    const event = plannerEvents[eventIndex];
    if (!event) {
        return;
    }

    const form = document.getElementById("event-form");
    clearPlannerFormErrors();
    editingEventIndex = eventIndex;
    form.elements.title.value = event.title;
    form.elements.date.value = event.date;
    form.elements.endDate.value = plannerLogic.getEventEndDate(event);
    form.elements.time.value = event.time || "";
    form.elements.endTime.value = event.endTime || "";
    form.elements.location.value = event.location || "";
    form.elements.type.value =
        event.type === "personal" ? "personal" : "deadline";
    form.elements.description.value = event.description || "";
    document.getElementById("event-heading").textContent = "Edit Event";
    document.getElementById("event-submit").textContent = "Save Changes";
    document.getElementById("cancel-edit").hidden = false;
    document.getElementById("event-details-dialog").close();
    form.elements.title.focus();
}

function deleteSelectedEvent() {
    const eventIndex = Number(
        document.getElementById("event-details-dialog").dataset.eventIndex
    );
    if (!Number.isInteger(eventIndex) || !plannerEvents[eventIndex]) {
        return;
    }

    if (!window.confirm("Delete this event? This cannot be undone.")) {
        return;
    }

    const updatedEvents = plannerEvents.filter((_, index) => index !== eventIndex);
    try {
        plannerLogic.savePlannerEvents(updatedEvents);
    } catch (error) {
        document.getElementById("event-dialog-error").textContent =
            error instanceof Error ? error.message : "Unable to delete the event.";
        return;
    }

    plannerEvents = updatedEvents;
    if (editingEventIndex === eventIndex) {
        resetEventForm();
    } else if (editingEventIndex !== null && editingEventIndex > eventIndex) {
        editingEventIndex -= 1;
    }
    document.getElementById("event-details-dialog").close();
    document.getElementById("event-dialog-error").textContent = "";
    renderCalendar();
}

function handleEventFormSubmit(submitEvent) {
    submitEvent.preventDefault();
    clearPlannerFormErrors();

    const form = submitEvent.currentTarget;
    const event = {
        title: form.elements.title.value.trim(),
        date: form.elements.date.value,
        endDate: form.elements.endDate.value || form.elements.date.value,
        time: form.elements.time.value,
        endTime: form.elements.endTime.value,
        location: form.elements.location.value.trim(),
        type: form.elements.type.value,
        description: form.elements.description.value.trim(),
    };
    const errors = plannerLogic.validateEvent(event);

    setPlannerFieldError(
        form.elements.title,
        document.getElementById("title-error"),
        errors.title
    );
    setPlannerFieldError(
        form.elements.date,
        document.getElementById("date-error"),
        errors.date
    );
    setPlannerFieldError(
        form.elements.endDate,
        document.getElementById("end-date-error"),
        errors.endDate
    );
    setPlannerFieldError(
        form.elements.time,
        document.getElementById("time-error"),
        errors.time
    );
    setPlannerFieldError(
        form.elements.endTime,
        document.getElementById("end-time-error"),
        errors.endTime
    );

    if (Object.keys(errors).length > 0) {
        return;
    }

    if (
        editingEventIndex !== null &&
        !plannerEvents[editingEventIndex]
    ) {
        resetEventForm();
        document.getElementById("event-error").textContent =
            "This event is no longer available to edit.";
        return;
    }

    const updatedEvents = editingEventIndex === null
        ? plannerEvents.concat(event)
        : plannerEvents.map((savedEvent, index) =>
            index === editingEventIndex ? event : savedEvent
        );
    try {
        plannerLogic.savePlannerEvents(updatedEvents);
    } catch (error) {
        document.getElementById("event-error").textContent =
            error instanceof Error ? error.message : "Unable to save the event.";
        return;
    }

    plannerEvents = updatedEvents;
    const [year, month, day] = event.date.split("-").map(Number);
    currentDate = new Date(year, month - 1, day);
    resetEventForm();
    renderCalendar();
}

function loadSavedPlannerEvents() {
    try {
        plannerEvents = plannerLogic.loadPlannerEvents().filter(
            (event) => Object.keys(plannerLogic.validateEvent(event)).length === 0
        );
    } catch (error) {
        document.getElementById("event-error").textContent =
            error instanceof Error ? error.message : "Unable to load saved events.";
    }

    renderCalendar();
}

document
    .getElementById("event-form")
    .addEventListener("submit", handleEventFormSubmit);
document.getElementById("event-date").addEventListener("change", (changeEvent) => {
    const endDate = document.getElementById("event-end-date");
    if (!endDate.value || endDate.value < changeEvent.currentTarget.value) {
        endDate.value = changeEvent.currentTarget.value;
    }
});
calendarGrid.addEventListener("click", (clickEvent) => {
    const eventButton = clickEvent.target.closest(".calendar-event");
    if (!eventButton || !calendarGrid.contains(eventButton)) {
        return;
    }

    const eventIndex = Number(eventButton.dataset.eventIndex);
    if (!Number.isInteger(eventIndex)) {
        return;
    }

    const dialog = document.getElementById("event-details-dialog");
    dialog.dataset.eventIndex = String(eventIndex);
    showEventDetails(eventIndex);
});
document.getElementById("event-edit").addEventListener("click", beginEventEdit);
document.getElementById("event-delete").addEventListener("click", deleteSelectedEvent);
document.getElementById("event-details-close").addEventListener("click", () => {
    document.getElementById("event-details-dialog").close();
});
document.getElementById("cancel-edit").addEventListener("click", resetEventForm);
loadSavedPlannerEvents();