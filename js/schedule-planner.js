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

            calendarGrid.appendChild(cell);
        }
    }
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