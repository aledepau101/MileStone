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

const plannerLogic = globalThis.plannerLogic;
if (!plannerLogic || typeof plannerLogic.isValidDateKey !== "function") {
    throw new Error("Thesis Milestones requires planner-logic.js to load first.");
}

let thesis = { finalDeadline: null, milestones: [] };
let editingMilestoneId = null;
let editingMilestoneDraft = null;
let tasks = [];
let tasksLoading = true;
let taskLoadError = "";
const expandedMilestoneIds = new Set();
const addingTaskMilestoneIds = new Set();
const submittingTaskMilestoneIds = new Set();
const savingMilestoneIds = new Set();
const updatingTaskIds = new Set();
const taskErrors = new Map();
const taskFormStates = new Map();

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

function getTasksForMilestone(milestoneId) {
    return tasks
        .filter((task) => task.milestoneId === milestoneId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}

function getTaskFormState(milestoneId) {
    if (!taskFormStates.has(milestoneId)) {
        taskFormStates.set(milestoneId, {
            name: "",
            dueDate: "",
            nameError: "",
            dueDateError: "",
            formError: "",
        });
    }
    return taskFormStates.get(milestoneId);
}

function createTaskRow(task) {
    const row = document.createElement("li");
    row.className = `thesis-task-row${task.completed ? " is-completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.disabled = updatingTaskIds.has(task.id);
    checkbox.className = "thesis-task-checkbox";
    checkbox.setAttribute(
        "aria-label",
        task.completed ? `Mark ${task.name} incomplete` : `Mark ${task.name} complete`
    );

    const name = document.createElement("span");
    name.className = "thesis-task-name";
    name.textContent = task.name;

    const dueDate = document.createElement("time");
    dueDate.className = "thesis-task-date";
    dueDate.dateTime = task.dueDate;
    dueDate.textContent = formatDate(task.dueDate);

    row.append(checkbox, name, dueDate);
    if (task.completed) {
        const completedLabel = document.createElement("span");
        completedLabel.className = "thesis-task-completed";
        completedLabel.textContent = "Completed";
        row.appendChild(completedLabel);
    }

    const errorMessage = taskErrors.get(task.id);
    if (errorMessage) {
        const error = document.createElement("p");
        error.className = "thesis-task-error";
        error.setAttribute("role", "alert");
        error.textContent = errorMessage;
        row.appendChild(error);
    }

    checkbox.addEventListener("change", async () => {
        if (updatingTaskIds.has(task.id)) {
            checkbox.checked = task.completed;
            return;
        }

        const previousCompleted = task.completed;
        const completed = checkbox.checked;
        updatingTaskIds.add(task.id);
        taskErrors.delete(task.id);
        tasks = tasks.map((currentTask) =>
            currentTask.id === task.id ? { ...currentTask, completed } : currentTask
        );
        renderMilestones();

        try {
            const updatedTask = await thesisApi(`/api/tasks/${encodeURIComponent(task.id)}`, {
                method: "PATCH",
                body: JSON.stringify({ completed }),
            });
            tasks = tasks.map((currentTask) =>
                currentTask.id === task.id ? updatedTask : currentTask
            );
        } catch (error) {
            tasks = tasks.map((currentTask) =>
                currentTask.id === task.id
                    ? { ...currentTask, completed: previousCompleted }
                    : currentTask
            );
            taskErrors.set(
                task.id,
                error instanceof Error ? error.message : "Unable to update task completion."
            );
        } finally {
            updatingTaskIds.delete(task.id);
            renderMilestones();
        }
    });

    return row;
}

function createTaskForm(milestone) {
    const form = document.createElement("form");
    form.className = "thesis-task-form";
    form.id = `task-form-${milestone.id}`;
    form.noValidate = true;
    const state = getTaskFormState(milestone.id);
    const isSubmitting = submittingTaskMilestoneIds.has(milestone.id);

    const context = document.createElement("p");
    context.className = "thesis-task-context";
    context.textContent = `Milestone: ${milestone.name}`;

    const nameField = document.createElement("div");
    nameField.className = "thesis-task-field";
    const nameLabel = document.createElement("label");
    const nameRequired = document.createElement("span");
    nameLabel.textContent = "Task Name ";
    nameRequired.textContent = "*";
    nameRequired.setAttribute("aria-hidden", "true");
    nameLabel.appendChild(nameRequired);
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "name";
    nameInput.maxLength = 200;
    nameInput.required = true;
    nameInput.placeholder = "Enter a task name";
    nameInput.value = state.name;
    nameInput.disabled = tasksLoading || isSubmitting;
    const nameError = document.createElement("p");
    nameError.className = "thesis-task-error";
    nameError.setAttribute("role", "alert");
    nameError.hidden = true;
    nameLabel.htmlFor = `task-name-${milestone.id}`;
    nameInput.id = nameLabel.htmlFor;
    nameError.id = `task-name-error-${milestone.id}`;
    nameInput.setAttribute("aria-describedby", nameError.id);
    setFieldError(nameInput, nameError, state.nameError);
    nameField.append(nameLabel, nameInput, nameError);

    const dateField = document.createElement("div");
    dateField.className = "thesis-task-field";
    const dateLabel = document.createElement("label");
    const dateRequired = document.createElement("span");
    dateLabel.textContent = "Due Date ";
    dateRequired.textContent = "*";
    dateRequired.setAttribute("aria-hidden", "true");
    dateLabel.appendChild(dateRequired);
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.name = "dueDate";
    dateInput.required = true;
    dateInput.value = state.dueDate;
    dateInput.disabled = tasksLoading || isSubmitting;
    const dateError = document.createElement("p");
    dateError.className = "thesis-task-error";
    dateError.setAttribute("role", "alert");
    dateError.hidden = true;
    dateLabel.htmlFor = `task-date-${milestone.id}`;
    dateInput.id = dateLabel.htmlFor;
    dateError.id = `task-date-error-${milestone.id}`;
    dateInput.setAttribute("aria-describedby", dateError.id);
    setFieldError(dateInput, dateError, state.dueDateError);
    dateField.append(dateLabel, dateInput, dateError);

    const actions = document.createElement("div");
    actions.className = "thesis-task-form-actions";
    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "add-event-btn";
    submitButton.textContent = isSubmitting ? "Saving..." : "Save Task";
    submitButton.disabled = tasksLoading || isSubmitting;
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "cancel-edit-btn";
    cancelButton.textContent = "Cancel";
    cancelButton.disabled = isSubmitting;
    actions.append(submitButton, cancelButton);

    const formError = document.createElement("p");
    formError.className = "thesis-task-error thesis-task-form-error";
    formError.setAttribute("role", "alert");
    formError.textContent = state.formError;
    formError.hidden = !state.formError;
    form.append(context, nameField, dateField, actions, formError);

    nameInput.addEventListener("input", () => {
        state.name = nameInput.value;
        if (state.nameError) {
            state.nameError = "";
            setFieldError(nameInput, nameError, "");
        }
    });
    dateInput.addEventListener("input", () => {
        state.dueDate = dateInput.value;
        if (state.dueDateError) {
            state.dueDateError = "";
            setFieldError(dateInput, dateError, "");
        }
    });

    cancelButton.addEventListener("click", () => {
        addingTaskMilestoneIds.delete(milestone.id);
        taskFormStates.delete(milestone.id);
        renderMilestones();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (tasksLoading || submittingTaskMilestoneIds.has(milestone.id)) {
            return;
        }

        state.formError = "";
        formError.textContent = "";
        formError.hidden = true;
        const name = nameInput.value.trim();
        const dueDate = dateInput.value;
        state.name = nameInput.value;
        state.dueDate = dueDate;
        const nameErrorMessage = !name
            ? "Task name is required."
            : Array.from(name).length > 200
                ? "Task name must be 200 characters or fewer."
                : "";
        const dueDateErrorMessage = plannerLogic.isValidDateKey(dueDate)
            ? ""
            : "Enter a valid due date.";
        state.nameError = nameErrorMessage;
        state.dueDateError = dueDateErrorMessage;
        setFieldError(nameInput, nameError, nameErrorMessage);
        setFieldError(dateInput, dateError, dueDateErrorMessage);

        if (nameErrorMessage || dueDateErrorMessage) {
            (nameErrorMessage ? nameInput : dateInput).focus();
            return;
        }

        submittingTaskMilestoneIds.add(milestone.id);
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        cancelButton.disabled = true;
        nameInput.disabled = true;
        dateInput.disabled = true;

        try {
            const task = await thesisApi("/api/tasks", {
                method: "POST",
                body: JSON.stringify({ name, dueDate, milestoneId: milestone.id }),
            });
            tasks = [...tasks, task].sort((a, b) =>
                a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id)
            );
            taskErrors.delete(task.id);
            addingTaskMilestoneIds.delete(milestone.id);
            taskFormStates.delete(milestone.id);
        } catch (error) {
            const errors = error instanceof ApiError ? error.errors : {};
            state.nameError = errors.name || "";
            state.dueDateError = errors.dueDate || "";

            const hasFieldError = Boolean(errors.name || errors.dueDate);
            state.formError = errors.milestoneId ||
                (!hasFieldError
                    ? error instanceof Error
                        ? error.message
                        : "Unable to add the task."
                    : "");
        } finally {
            submittingTaskMilestoneIds.delete(milestone.id);
            renderMilestones();
        }
    });

    return form;
}

function createTaskPanel(milestone, isExpanded) {
    const panel = document.createElement("section");
    panel.id = `tasks-for-${milestone.id}`;
    panel.className = "thesis-task-panel";
    panel.hidden = !isExpanded;
    panel.setAttribute("aria-labelledby", `tasks-heading-${milestone.id}`);

    const header = document.createElement("div");
    header.className = "thesis-task-panel-header";
    const heading = document.createElement("h3");
    heading.id = `tasks-heading-${milestone.id}`;
    heading.textContent = "Tasks for this Milestone";
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "thesis-task-add-button";
    addButton.textContent = addingTaskMilestoneIds.has(milestone.id)
        ? "Cancel Add Task"
        : "＋ Add Task";
    addButton.disabled = tasksLoading || submittingTaskMilestoneIds.has(milestone.id);
    addButton.setAttribute(
        "aria-expanded",
        String(addingTaskMilestoneIds.has(milestone.id))
    );
    addButton.setAttribute("aria-controls", `task-form-${milestone.id}`);
    addButton.addEventListener("click", () => {
        if (addingTaskMilestoneIds.has(milestone.id)) {
            addingTaskMilestoneIds.delete(milestone.id);
        } else {
            addingTaskMilestoneIds.add(milestone.id);
        }
        renderMilestones();
    });
    header.append(heading, addButton);
    panel.appendChild(header);

    const taskForm = createTaskForm(milestone);
    taskForm.hidden = !addingTaskMilestoneIds.has(milestone.id);
    panel.appendChild(taskForm);

    if (tasksLoading) {
        const loading = document.createElement("p");
        loading.className = "thesis-task-status";
        loading.setAttribute("role", "status");
        loading.textContent = "Loading tasks...";
        panel.appendChild(loading);
    } else if (taskLoadError) {
        const error = document.createElement("p");
        error.className = "thesis-task-status thesis-task-error";
        error.setAttribute("role", "alert");
        error.textContent = taskLoadError;
        const retryButton = document.createElement("button");
        retryButton.type = "button";
        retryButton.className = "thesis-task-retry";
        retryButton.textContent = "Retry";
        retryButton.disabled = submittingTaskMilestoneIds.size > 0;
        retryButton.addEventListener("click", loadTasks);
        panel.append(error, retryButton);
        const milestoneTasks = getTasksForMilestone(milestone.id);
        if (milestoneTasks.length) {
            const list = document.createElement("ul");
            list.className = "thesis-task-list";
            list.setAttribute("aria-live", "polite");
            milestoneTasks.forEach((task) => list.appendChild(createTaskRow(task)));
            panel.appendChild(list);
        }
    } else {
        const milestoneTasks = getTasksForMilestone(milestone.id);
        if (!milestoneTasks.length) {
            const empty = document.createElement("p");
            empty.className = "thesis-task-empty";
            empty.textContent = "No tasks for this milestone yet.";
            panel.appendChild(empty);
        } else {
            const list = document.createElement("ul");
            list.className = "thesis-task-list";
            list.setAttribute("aria-live", "polite");
            milestoneTasks.forEach((task) => list.appendChild(createTaskRow(task)));
            panel.appendChild(list);
        }
    }

    return panel;
}

async function loadTasks() {
    if (submittingTaskMilestoneIds.size) {
        return;
    }

    tasksLoading = true;
    taskLoadError = "";
    renderMilestones();
    try {
        const result = await thesisApi("/api/tasks");
        if (!Array.isArray(result)) {
            throw new Error("Unable to load tasks.");
        }
        tasks = result;
    } catch (error) {
        taskLoadError = error instanceof Error
            ? error.message
            : "Unable to load tasks.";
    } finally {
        tasksLoading = false;
        renderMilestones();
    }
}

function createMilestoneRow(milestone) {
    if (editingMilestoneId === milestone.id) {
        if (!editingMilestoneDraft || editingMilestoneDraft.id !== milestone.id) {
            editingMilestoneDraft = {
                id: milestone.id,
                name: milestone.name,
                targetDate: milestone.targetDate,
                nameError: "",
                targetDateError: "",
                formError: "",
            };
        }
        const draft = editingMilestoneDraft;
        const isSaving = savingMilestoneIds.has(milestone.id);
        const row = document.createElement("li");
        row.className = "milestone-row";
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
        nameInput.value = draft.name;
        nameInput.disabled = isSaving;
        const nameError = document.createElement("p");
        nameError.className = "thesis-field-error";
        nameError.hidden = true;
        nameLabel.htmlFor = `edit-name-${milestone.id}`;
        nameInput.id = `edit-name-${milestone.id}`;
        nameError.id = `edit-name-error-${milestone.id}`;
        nameInput.setAttribute("aria-describedby", nameError.id);
        setFieldError(nameInput, nameError, draft.nameError);
        nameField.append(nameLabel, nameInput, nameError);

        const dateField = document.createElement("div");
        dateField.className = "milestone-edit-field";
        const dateLabel = document.createElement("label");
        dateLabel.textContent = "Target Date";
        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.name = "targetDate";
        dateInput.required = true;
        dateInput.value = draft.targetDate;
        dateInput.disabled = isSaving;
        const dateError = document.createElement("p");
        dateError.className = "thesis-field-error";
        dateError.hidden = true;
        dateLabel.htmlFor = `edit-date-${milestone.id}`;
        dateInput.id = `edit-date-${milestone.id}`;
        dateError.id = `edit-date-error-${milestone.id}`;
        dateInput.setAttribute("aria-describedby", dateError.id);
        setFieldError(dateInput, dateError, draft.targetDateError);
        dateField.append(dateLabel, dateInput, dateError);

        const actions = document.createElement("div");
        actions.className = "milestone-edit-actions";
        const saveButton = document.createElement("button");
        saveButton.type = "submit";
        saveButton.className = "add-event-btn";
        saveButton.textContent = isSaving ? "Saving..." : "Save";
        saveButton.disabled = isSaving;
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "cancel-edit-btn";
        cancelButton.textContent = "Cancel";
        cancelButton.disabled = isSaving;
        actions.append(saveButton, cancelButton);

        const editError = document.createElement("p");
        editError.className = "thesis-field-error milestone-edit-error";
        editError.setAttribute("role", "alert");
        editError.textContent = draft.formError;
        editError.hidden = !draft.formError;
        form.append(nameField, dateField, actions, editError);

        nameInput.addEventListener("input", () => {
            draft.name = nameInput.value;
            if (draft.nameError) {
                draft.nameError = "";
                setFieldError(nameInput, nameError, "");
            }
        });
        dateInput.addEventListener("input", () => {
            draft.targetDate = dateInput.value;
            if (draft.targetDateError) {
                draft.targetDateError = "";
                setFieldError(dateInput, dateError, "");
            }
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (savingMilestoneIds.has(milestone.id)) {
                return;
            }

            const name = nameInput.value.trim();
            const targetDate = dateInput.value;
            draft.name = nameInput.value;
            draft.targetDate = targetDate;
            draft.nameError = name ? "" : "Milestone name is required.";
            draft.targetDateError = targetDate ? "" : "Target date is required.";
            draft.formError = "";
            setFieldError(nameInput, nameError, draft.nameError);
            setFieldError(dateInput, dateError, draft.targetDateError);
            editError.textContent = "";
            editError.hidden = true;
            if (draft.nameError || draft.targetDateError) {
                return;
            }

            savingMilestoneIds.add(milestone.id);
            saveButton.disabled = true;
            saveButton.textContent = "Saving...";
            cancelButton.disabled = true;
            nameInput.disabled = true;
            dateInput.disabled = true;
            try {
                await thesisApi(`/api/milestones/${encodeURIComponent(milestone.id)}`, {
                    method: "PUT",
                    body: JSON.stringify({ name, targetDate }),
                });
                editingMilestoneId = null;
                editingMilestoneDraft = null;
                await loadThesis();
            } catch (error) {
                const errors = error instanceof ApiError ? error.errors : {};
                draft.nameError = errors.name || "";
                draft.targetDateError = errors.targetDate || "";
                const hasFieldError = Boolean(draft.nameError || draft.targetDateError);
                draft.formError = !hasFieldError
                    ? error instanceof Error
                        ? error.message
                        : "Unable to save the milestone."
                    : "";
            } finally {
                savingMilestoneIds.delete(milestone.id);
                renderMilestones();
            }
        });
        cancelButton.addEventListener("click", () => {
            editingMilestoneId = null;
            editingMilestoneDraft = null;
            renderMilestones();
        });

        row.appendChild(form);
        return row;
    }

    const card = document.createElement("li");
    card.className = "thesis-milestone-card";
    const row = document.createElement("div");
    row.className = "thesis-milestone-summary";

    const isExpanded = expandedMilestoneIds.has(milestone.id);
    const toggleMilestoneTasks = () => {
        if (expandedMilestoneIds.has(milestone.id)) {
            expandedMilestoneIds.delete(milestone.id);
        } else {
            expandedMilestoneIds.add(milestone.id);
        }
        renderMilestones();
    };

    const expandButton = document.createElement("button");
    expandButton.type = "button";
    expandButton.className = "thesis-milestone-expand";
    expandButton.textContent = isExpanded ? "⌄" : "›";
    expandButton.setAttribute("aria-expanded", String(isExpanded));
    expandButton.setAttribute("aria-controls", `tasks-for-${milestone.id}`);
    expandButton.setAttribute(
        "aria-label",
        `${isExpanded ? "Collapse" : "Expand"} tasks for ${milestone.name}`
    );
    expandButton.addEventListener("click", toggleMilestoneTasks);

    const details = document.createElement("div");
    details.className = "milestone-row-main thesis-milestone-main";
    const name = document.createElement("span");
    name.className = "milestone-name";
    name.textContent = milestone.name;
    const date = document.createElement("time");
    date.className = "milestone-date";
    date.dateTime = milestone.targetDate;
    date.textContent = formatDate(milestone.targetDate);
    details.append(name, date);

    const actions = document.createElement("div");
    actions.className = "milestone-row-actions thesis-milestone-actions";
    const viewTasksButton = document.createElement("button");
    viewTasksButton.type = "button";
    viewTasksButton.className = "thesis-task-toggle";
    viewTasksButton.textContent = isExpanded ? "Hide Tasks" : "View Tasks";
    viewTasksButton.setAttribute("aria-expanded", String(isExpanded));
    viewTasksButton.setAttribute("aria-controls", `tasks-for-${milestone.id}`);
    viewTasksButton.setAttribute(
        "aria-label",
        `${isExpanded ? "Hide" : "View"} tasks for ${milestone.name}`
    );
    viewTasksButton.addEventListener("click", toggleMilestoneTasks);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "thesis-edit-button";
    editButton.textContent = "Edit";
    editButton.disabled = savingMilestoneIds.size > 0;
    editButton.setAttribute("aria-label", `Edit ${milestone.name}`);
    editButton.addEventListener("click", () => {
        if (savingMilestoneIds.size > 0) {
            return;
        }
        editingMilestoneId = milestone.id;
        editingMilestoneDraft = {
            id: milestone.id,
            name: milestone.name,
            targetDate: milestone.targetDate,
            nameError: "",
            targetDateError: "",
            formError: "",
        };
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
            expandedMilestoneIds.delete(milestone.id);
            addingTaskMilestoneIds.delete(milestone.id);
            await loadThesis();
            await loadTasks();
        } catch (error) {
            milestoneListError.textContent = error instanceof Error
                ? error.message
                : "Unable to delete the milestone.";
            milestoneListError.hidden = false;
        } finally {
            deleteButton.disabled = false;
        }
    });
    actions.append(viewTasksButton, editButton, deleteButton);
    row.append(expandButton, details, actions);
    card.append(row, createTaskPanel(milestone, isExpanded));
    return card;
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
loadTasks();
