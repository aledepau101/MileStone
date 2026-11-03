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

// Create weekday headings.
function createDayHeaders() {
    dayNames.forEach((day) => {
        const heading = document.createElement("div");
        heading.className = "calendar-day-header";
        heading.textContent = day;
        calendarGrid.appendChild(heading);
    });
}

// Display the monthly calendar.
function renderMonth() {
    calendarGrid.innerHTML = "";

    calendarTitle.textContent = currentDate.toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric" }
    );

    createDayHeaders();

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

    for(let i = 0; i < totalDays; i++) {
        const date = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate() + i
        );

        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day";
        dayCell.textContent = date.getDate();
        dayCell.dataset.date = plannerLogic.getDateKey(date);

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

        calendarGrid.appendChild(dayCell);
    }
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

        calendarGrid.appendChild(heading);
    }

    const allDayLabel = document.createElement("div");
    allDayLabel.className = "week-time-label";
    allDayLabel.textContent = "All day";
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
        calendarGrid.appendChild(cell);
    }

    // Hourly rows from 8 AM through 8 PM.
    for (let hour = 8; hour <= 20; hour++) {
        const timeLabel = document.createElement("div");
        timeLabel.className = "week-time-label";

        const displayHour = hour % 12 || 12;
        const period = hour < 12 ? "AM" : "PM";

        timeLabel.textContent = displayHour + " " + period;
        calendarGrid.appendChild(timeLabel);

        for (let day = 0; day < 7; day++) {
            const cell = document.createElement("div");
            cell.className = "week-hour-cell";
            cell.dataset.hour = String(hour);
            cell.dataset.day = String(day);
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

function createEventElement(event, eventIndex) {
    const eventElement = document.createElement("button");
    eventElement.type = "button";
    eventElement.className = "calendar-event";
    eventElement.dataset.eventIndex = String(eventIndex);
    eventElement.setAttribute("aria-label", "View event: " + event.title);

    if (event.type === "deadline" || event.type === "personal") {
        eventElement.classList.add(event.type);
    }

    const title = document.createElement("span");
    title.className = "calendar-event-title";
    title.textContent = event.title;
    eventElement.appendChild(title);

    const time = formatEventTime(event.time);
    if (time) {
        const timeElement = document.createElement("span");
        timeElement.className = "calendar-event-time";
        timeElement.textContent = time;
        eventElement.appendChild(timeElement);
    }

    return eventElement;
}

function renderEvents() {
    const validEvents = plannerEvents
        .map((event, index) => ({ event, index }))
        .filter(({ event }) =>
            Object.keys(plannerLogic.validateEvent(event)).length === 0
        );

    if (currentView === "month") {
        calendarGrid.querySelectorAll(".calendar-day").forEach((dayCell) => {
            validEvents
                .filter(({ event }) => event.date === dayCell.dataset.date)
                .forEach(({ event, index }) =>
                    dayCell.appendChild(createEventElement(event, index))
                );
        });
        return;
    }

    const allDayCells = calendarGrid.querySelectorAll(".week-all-day-cell");
    const timedCells = calendarGrid.querySelectorAll(".week-hour-cell");

    validEvents.forEach(({ event, index }) => {
        const parsedTime = plannerLogic.parseEventTime(event.time);
        if (!parsedTime) {
            const cell = Array.from(allDayCells).find(
                (allDayCell) => allDayCell.dataset.date === event.date
            );
            if (cell) {
                cell.appendChild(createEventElement(event, index));
            }
            return;
        }

        const visibleHour = Math.max(8, Math.min(20, parsedTime.hour));
        const cell = Array.from(timedCells).find(
            (timedCell) =>
                timedCell.dataset.date === event.date &&
                Number(timedCell.dataset.hour) === visibleHour
        );

        if (cell) {
            cell.appendChild(createEventElement(event, index));
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

function showEventDetails(eventIndex) {
    const event = plannerEvents[eventIndex];
    if (!event) {
        return;
    }

    document.getElementById("event-details-title").textContent = event.title;
    document.getElementById("event-details-date").textContent =
        formatEventDate(event.date);
    document.getElementById("event-details-time").textContent =
        formatEventTime(event.time) || "All day";
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
    form.elements.time.value = event.time || "";
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
        time: form.elements.time.value,
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