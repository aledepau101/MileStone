"use strict";

const pageError = document.getElementById("page-error");
const deadlineValue = document.getElementById("deadline-value");
const deadlineHint = document.getElementById("deadline-hint");
const deadlineEditButton = document.getElementById("deadline-edit-button");
const deadlineForm = document.getElementById("deadline-form");
const finalDeadlineInput = document.getElementById("final-deadline-input");
const deadlineError = document.getElementById("deadline-error");
const milestoneForm = document.getElementById("milestone-form");
const milestoneNameInput = document.getElementById("milestone-name");
const milestoneDateInput = document.getElementById("milestone-date");
const milestoneSubmit = document.getElementById("milestone-submit");
const deadlineRequiredHint = document.getElementById("deadline-required-hint");
const milestoneFormError = document.getElementById("milestone-form-error");
const milestoneNameError = document.getElementById("milestone-name-error");
const milestoneDateError = document.getElementById("milestone-date-error");
const milestoneList = document.getElementById("milestone-list");
const milestoneListError = document.getElementById("milestone-list-error");
const milestoneEmpty = document.getElementById("milestone-empty");

let thesis = { finalDeadline: null, milestones: [] };
let editingMilestoneId = null;

class ApiError extends Error {
    constructor(message, data = {}) {
        super(message);
        this.errors = data.errors || {};
        this.conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];
    }
}

async function thesisApi(path, options = {}) {
    const response = await fetch(path, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        ...options,
    });

    if (response.status === 401) {
        window.location.assign("login.html");
        throw new Error("Please log in.");
    }

    const data = response.status === 204
        ? null
        : await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data.errors
            ? Object.values(data.errors).join(" ")
            : data.error || "Request failed.";
        throw new ApiError(message, data);
    }
    return data;
}

function formatDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function setFieldError(input, errorElement, message) {
    errorElement.textContent = message || "";
    errorElement.hidden = !message;
    if (message) {
        input.setAttribute("aria-invalid", "true");
    } else {
        input.removeAttribute("aria-invalid");
    }
}

function clearMilestoneFormErrors() {
    setFieldError(milestoneNameInput, milestoneNameError, "");
    setFieldError(milestoneDateInput, milestoneDateError, "");
    milestoneFormError.textContent = "";
    milestoneFormError.hidden = true;
}

function setDeadlineError(error) {
    deadlineError.replaceChildren();
    const message = document.createElement("span");
    message.textContent = error instanceof Error
        ? error.message
        : "Unable to save the final deadline.";
    deadlineError.appendChild(message);

    if (error instanceof ApiError && error.conflicts.length) {
        const conflicts = document.createElement("ul");
        error.conflicts.forEach((milestone) => {
            const item = document.createElement("li");
            item.textContent = `${milestone.name} — ${formatDate(milestone.targetDate)}`;
            conflicts.appendChild(item);
        });
        deadlineError.appendChild(conflicts);
    }
    deadlineError.hidden = false;
}

function renderDeadline() {
    const hasDeadline = Boolean(thesis.finalDeadline);
    deadlineValue.textContent = hasDeadline
        ? formatDate(thesis.finalDeadline)
        : "No final deadline set";
    deadlineHint.textContent = hasDeadline
        ? "All milestones must be set before or on this date."
        : "Set a final deadline before adding milestones.";
    deadlineEditButton.textContent = hasDeadline ? "Edit Deadline" : "Set Deadline";
    deadlineEditButton.disabled = false;
    milestoneNameInput.disabled = !hasDeadline;
    milestoneDateInput.disabled = !hasDeadline;
    milestoneSubmit.disabled = !hasDeadline;
    deadlineRequiredHint.hidden = hasDeadline;
}

function createMilestoneRow(milestone) {
    const row = document.createElement("li");
    row.className = "milestone-row";

    if (editingMilestoneId === milestone.id) {
        const form = document.createElement("form");
        form.className = "milestone-edit-form";
        form.noValidate = true;

        const nameField = document.createElement("div");
        nameField.className = "milestone-edit-field";
        const nameLabel = document.createElement("label");
        nameLabel.textContent = "Milestone Name";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.name = "name";
        nameInput.maxLength = 200;
        nameInput.required = true;
        nameInput.value = milestone.name;
        const nameError = document.createElement("p");
        nameError.className = "thesis-field-error";
        nameError.hidden = true;
        nameLabel.htmlFor = `edit-name-${milestone.id}`;
        nameInput.id = `edit-name-${milestone.id}`;
        nameError.id = `edit-name-error-${milestone.id}`;
        nameInput.setAttribute("aria-describedby", nameError.id);
        nameField.append(nameLabel, nameInput, nameError);

        const dateField = document.createElement("div");
        dateField.className = "milestone-edit-field";
        const dateLabel = document.createElement("label");
        dateLabel.textContent = "Target Date";
        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.name = "targetDate";
        dateInput.required = true;
        dateInput.value = milestone.targetDate;
        const dateError = document.createElement("p");
        dateError.className = "thesis-field-error";
        dateError.hidden = true;
        dateLabel.htmlFor = `edit-date-${milestone.id}`;
        dateInput.id = `edit-date-${milestone.id}`;
        dateError.id = `edit-date-error-${milestone.id}`;
        dateInput.setAttribute("aria-describedby", dateError.id);
        dateField.append(dateLabel, dateInput, dateError);

        const actions = document.createElement("div");
        actions.className = "milestone-edit-actions";
        const saveButton = document.createElement("button");
        saveButton.type = "submit";
        saveButton.className = "add-event-btn";
        saveButton.textContent = "Save";
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "cancel-edit-btn";
        cancelButton.textContent = "Cancel";
        actions.append(saveButton, cancelButton);

        const editError = document.createElement("p");
        editError.className = "thesis-field-error milestone-edit-error";
        editError.setAttribute("role", "alert");
        editError.hidden = true;
        form.append(nameField, dateField, actions, editError);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const name = nameInput.value.trim();
            const targetDate = dateInput.value;
            setFieldError(nameInput, nameError, name ? "" : "Milestone name is required.");
            setFieldError(dateInput, dateError, targetDate ? "" : "Target date is required.");
            if (!name || !targetDate) {
                return;
            }

            saveButton.disabled = true;
            try {
                await thesisApi(`/api/milestones/${encodeURIComponent(milestone.id)}`, {
                    method: "PUT",
                    body: JSON.stringify({ name, targetDate }),
                });
                editingMilestoneId = null;
                await loadThesis();
            } catch (error) {
                if (error instanceof ApiError && error.errors.name) {
                    setFieldError(nameInput, nameError, error.errors.name);
                }
                if (error instanceof ApiError && error.errors.targetDate) {
                    setFieldError(dateInput, dateError, error.errors.targetDate);
                }
                if (!nameError.textContent && !dateError.textContent) {
                    editError.textContent = error instanceof Error
                        ? error.message
                        : "Unable to save the milestone.";
                    editError.hidden = false;
                }
            } finally {
                saveButton.disabled = false;
            }
        });
        cancelButton.addEventListener("click", () => {
            editingMilestoneId = null;
            renderMilestones();
        });

        row.appendChild(form);
        return row;
    }

    const details = document.createElement("div");
    details.className = "milestone-row-main";
    const name = document.createElement("span");
    name.className = "milestone-name";
    name.textContent = milestone.name;
    const date = document.createElement("time");
    date.className = "milestone-date";
    date.dateTime = milestone.targetDate;
    date.textContent = formatDate(milestone.targetDate);
    details.append(name, date);

    const actions = document.createElement("div");
    actions.className = "milestone-row-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "thesis-edit-button";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", `Edit ${milestone.name}`);
    editButton.addEventListener("click", () => {
        editingMilestoneId = milestone.id;
        milestoneListError.textContent = "";
        milestoneListError.hidden = true;
        renderMilestones();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "thesis-delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${milestone.name}`);
    deleteButton.addEventListener("click", async () => {
        deleteButton.disabled = true;
        try {
            await thesisApi(`/api/milestones/${encodeURIComponent(milestone.id)}`, {
                method: "DELETE",
            });
            await loadThesis();
        } catch (error) {
            milestoneListError.textContent = error instanceof Error
                ? error.message
                : "Unable to delete the milestone.";
            milestoneListError.hidden = false;
        } finally {
            deleteButton.disabled = false;
        }
    });
    actions.append(editButton, deleteButton);
    row.append(details, actions);
    return row;
}

function renderMilestones() {
    milestoneList.replaceChildren();
    const milestones = [...thesis.milestones].sort((a, b) =>
        a.targetDate.localeCompare(b.targetDate) || a.id.localeCompare(b.id)
    );
    milestoneEmpty.hidden = milestones.length > 0;
    milestones.forEach((milestone) => {
        milestoneList.appendChild(createMilestoneRow(milestone));
    });
}

async function loadThesis() {
    pageError.textContent = "";
    pageError.hidden = true;
    try {
        thesis = await thesisApi("/api/thesis");
        milestoneListError.textContent = "";
        milestoneListError.hidden = true;
        renderDeadline();
        renderMilestones();
    } catch (error) {
        pageError.textContent = error instanceof Error
            ? error.message
            : "Unable to load thesis milestones.";
        pageError.hidden = false;
    }
}

deadlineEditButton.addEventListener("click", () => {
    finalDeadlineInput.value = thesis.finalDeadline || "";
    deadlineError.textContent = "";
    deadlineError.hidden = true;
    deadlineEditButton.hidden = true;
    deadlineForm.hidden = false;
    finalDeadlineInput.focus();
});

document.getElementById("deadline-cancel").addEventListener("click", () => {
    deadlineForm.hidden = true;
    deadlineEditButton.hidden = false;
    deadlineError.textContent = "";
    deadlineError.hidden = true;
});

deadlineForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!finalDeadlineInput.value) {
        setDeadlineError(new Error("Final deadline is required."));
        return;
    }

    const saveButton = deadlineForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    try {
        await thesisApi("/api/thesis/deadline", {
            method: "PUT",
            body: JSON.stringify({ finalDeadline: finalDeadlineInput.value }),
        });
        deadlineForm.hidden = true;
        deadlineEditButton.hidden = false;
        await loadThesis();
    } catch (error) {
        setDeadlineError(error);
    } finally {
        saveButton.disabled = false;
    }
});

milestoneForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMilestoneFormErrors();

    const name = milestoneNameInput.value.trim();
    const targetDate = milestoneDateInput.value;
    setFieldError(milestoneNameInput, milestoneNameError, name ? "" : "Milestone name is required.");
    setFieldError(milestoneDateInput, milestoneDateError, targetDate ? "" : "Target date is required.");
    if (!name || !targetDate) {
        return;
    }

    milestoneSubmit.disabled = true;
    try {
        await thesisApi("/api/milestones", {
            method: "POST",
            body: JSON.stringify({ name, targetDate }),
        });
        milestoneForm.reset();
        await loadThesis();
    } catch (error) {
        if (error instanceof ApiError && error.errors.name) {
            setFieldError(milestoneNameInput, milestoneNameError, error.errors.name);
        }
        if (error instanceof ApiError && error.errors.targetDate) {
            setFieldError(milestoneDateInput, milestoneDateError, error.errors.targetDate);
        }
        if (!milestoneNameError.textContent && !milestoneDateError.textContent) {
            milestoneFormError.textContent = error instanceof Error
                ? error.message
                : "Unable to add the milestone.";
            milestoneFormError.hidden = false;
        }
    } finally {
        milestoneSubmit.disabled = !thesis.finalDeadline;
    }
});

loadThesis();
