"use strict";

const rootTiles = document.getElementById("workspace-root-tiles");
const pageError = document.getElementById("workspace-page-error");
const folderError = document.getElementById("workspace-folder-error");
const folderHeading = document.getElementById("workspace-folder-heading");
const breadcrumbs = document.getElementById("workspace-breadcrumbs");
const entries = document.getElementById("workspace-entries");
const emptyFolder = document.getElementById("workspace-empty");
const recentList = document.getElementById("workspace-recent-list");
const recentEmpty = document.getElementById("workspace-recent-empty");
const addButton = document.getElementById("workspace-add-button");
const addMenu = document.getElementById("workspace-add-menu");
const dialog = document.getElementById("workspace-dialog");
const dialogTitle = document.getElementById("workspace-dialog-title");
const dialogForm = document.getElementById("workspace-dialog-form");
const dialogFields = document.getElementById("workspace-dialog-fields");
const dialogError = document.getElementById("workspace-dialog-error");
const dialogSubmit = document.getElementById("workspace-dialog-submit");

let workspace = null;
let activeFolderId = null;
let dialogAction = null;
let dialogFieldSequence = 0;

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function workspaceApi(url, options = {}) {
    const requestOptions = {
        credentials: "same-origin",
        ...options,
    };
    if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
        requestOptions.headers = {
            "Content-Type": "application/json",
            ...requestOptions.headers,
        };
    }

    const response = await fetch(url, requestOptions);
    if (response.status === 401) {
        window.location.assign("login.html");
        throw new ApiError("Please log in.", 401);
    }

    const data = response.status === 204
        ? null
        : await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new ApiError(data && data.error ? data.error : "Request failed.", response.status);
    }
    return data;
}

function setMessage(element, message) {
    element.textContent = message || "";
    element.hidden = !message;
}

function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

function findFolder(folderId, nodes = workspace ? workspace.folderTree : []) {
    for (const folder of nodes) {
        if (folder.id === folderId) {
            return folder;
        }
        const nested = findFolder(folderId, folder.children);
        if (nested) {
            return nested;
        }
    }
    return null;
}

function findRootFolder(folderId) {
    let current = findFolder(folderId);
    while (current && current.parentId) {
        current = findFolder(current.parentId);
    }
    return current;
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatSize(bytes) {
    if (bytes === null || bytes === undefined) {
        return "—";
    }
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function itemType(item) {
    if (item.kind === "note") {
        return "Note";
    }
    if (item.mimeType === "application/pdf") {
        return "PDF";
    }
    if (item.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return "DOCX";
    }
    return "TXT";
}

function setAddMenuOpen(isOpen) {
    addMenu.hidden = !isOpen;
    addButton.setAttribute("aria-expanded", String(isOpen));
}

function renderRootTiles() {
    rootTiles.replaceChildren();
    workspace.roots.forEach((root) => {
        const tile = createElement("button", "workspace-root-tile");
        tile.type = "button";
        const rootFolder = findRootFolder(activeFolderId);
        const isSelected = rootFolder && rootFolder.id === root.id;
        tile.classList.toggle("selected", Boolean(isSelected));
        tile.setAttribute("aria-pressed", String(Boolean(isSelected)));

        const icon = createElement("span", "workspace-folder-icon", " ");
        icon.setAttribute("aria-hidden", "true");
        const details = createElement("span", "workspace-root-details");
        details.append(
            createElement("strong", "workspace-root-name", root.name),
            createElement("span", "workspace-root-count", `${root.itemCount} items`),
        );
        const arrow = createElement("span", "workspace-root-arrow", "›");
        arrow.setAttribute("aria-hidden", "true");
        tile.append(icon, details, arrow);
        tile.addEventListener("click", () => openFolder(root.id));
        rootTiles.appendChild(tile);
    });
}

function renderBreadcrumbs(folderData) {
    breadcrumbs.replaceChildren();
    folderData.breadcrumbs.forEach((folder, index) => {
        const item = createElement("li", "workspace-breadcrumb");
        if (index === folderData.breadcrumbs.length - 1) {
            const current = createElement("span", "", folder.name);
            current.setAttribute("aria-current", "page");
            item.appendChild(current);
        } else {
            const link = createElement("button", "", folder.name);
            link.type = "button";
            link.addEventListener("click", () => openFolder(folder.id));
            item.appendChild(link);
        }
        breadcrumbs.appendChild(item);
    });
}

function makeMenuButton(label, action) {
    const button = createElement("button", "", label);
    button.type = "button";
    button.addEventListener("click", (event) => {
        const menu = event.currentTarget.closest("details");
        if (menu) {
            menu.open = false;
        }
        action();
    });
    return button;
}

function makeActionMenu(actions, label) {
    const details = createElement("details", "workspace-entry-menu");
    const summary = createElement("summary", "", "⋮");
    summary.setAttribute("aria-label", label);
    const menu = createElement("div", "workspace-entry-menu-options");
    actions.forEach(({ label: actionLabel, action }) => {
        menu.appendChild(makeMenuButton(actionLabel, action));
    });
    details.append(summary, menu);
    return details;
}

function renderFolderEntry(folder) {
    const row = createElement("li", "workspace-entry workspace-folder-entry");
    const main = createElement("div", "workspace-entry-main");
    const icon = createElement("span", "workspace-folder-icon", " ");
    icon.setAttribute("aria-hidden", "true");
    const openButton = createElement("button", "workspace-entry-name", folder.name);
    openButton.type = "button";
    openButton.addEventListener("click", () => openFolder(folder.id));
    const metadata = createElement(
        "span",
        "workspace-entry-meta",
        `Folder · — · Updated ${formatDate(folder.updatedAt)}`,
    );
    main.append(icon, openButton, metadata);
    row.appendChild(main);
    if (!folder.rootKey) {
        row.appendChild(makeActionMenu([
            { label: "Rename", action: () => openRenameDialog("folder", folder) },
            { label: "Delete", action: () => deleteFolder(folder) },
        ], `Actions for folder ${folder.name}`));
    }
    return row;
}

function downloadItem(item) {
    return fetch(`/api/workspace/items/${encodeURIComponent(item.id)}/download`, {
        credentials: "same-origin",
    }).then(async (response) => {
        if (response.status === 401) {
            window.location.assign("login.html");
            throw new ApiError("Please log in.", 401);
        }
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new ApiError(data.error || "Unable to download this file.", response.status);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = createElement("a");
        link.href = objectUrl;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    });
}

function renderItemEntry(item, isRecent = false) {
    const row = createElement(
        "li",
        isRecent ? "workspace-recent-entry" : "workspace-entry workspace-item-entry",
    );
    const main = createElement("div", isRecent ? "workspace-recent-main" : "workspace-entry-main");
    const icon = createElement(
        "span",
        `workspace-item-icon ${item.kind === "note" ? "note" : "file"}`,
        item.kind === "note" ? "▤" : "▤",
    );
    icon.setAttribute("aria-hidden", "true");
    const details = createElement(isRecent ? "div" : "div", "workspace-item-details");
    const nameButton = createElement("button", "workspace-entry-name", item.name);
    nameButton.type = "button";
    nameButton.addEventListener("click", () => {
        if (item.kind === "note") {
            openEditNote(item);
        } else {
            downloadItem(item).catch(showPageError);
        }
    });
    details.appendChild(nameButton);

    if (isRecent) {
        details.appendChild(createElement("span", "workspace-entry-meta", formatDate(item.updatedAt)));
        details.appendChild(createElement(
            "span",
            "workspace-recent-path",
            item.folderPath.join(" / "),
        ));
    } else {
        details.appendChild(createElement(
            "span",
            "workspace-entry-meta",
            `${itemType(item)} · ${formatSize(item.size)} · Updated ${formatDate(item.updatedAt)}`,
        ));
    }
    main.append(icon, details);

    const actions = [
        ...(item.kind === "note" ? [{ label: "Edit", action: () => openEditNote(item) }] : []),
        { label: "Rename", action: () => openRenameDialog("item", item) },
        ...(item.kind === "upload" ? [{ label: "Download", action: () => downloadItem(item).catch(showPageError) }] : []),
        { label: "Delete", action: () => deleteItem(item) },
    ];
    row.append(main, makeActionMenu(actions, `Actions for ${item.name}`));
    return row;
}

function renderFolderContents(folderData) {
    folderHeading.textContent = folderData.folder.name;
    renderBreadcrumbs(folderData);
    entries.replaceChildren();
    folderData.subfolders.forEach((folder) => {
        entries.appendChild(renderFolderEntry(folder));
    });
    folderData.items.forEach((item) => {
        entries.appendChild(renderItemEntry(item));
    });
    emptyFolder.textContent = "This folder is empty. Use Add to create a folder, upload a file, or add a note.";
    emptyFolder.hidden = folderData.subfolders.length + folderData.items.length > 0;
}

function renderRecentItems() {
    recentList.replaceChildren();
    workspace.recentItems.forEach((item) => {
        recentList.appendChild(renderItemEntry(item, true));
    });
    recentEmpty.hidden = workspace.recentItems.length > 0;
}

async function openFolder(folderId) {
    activeFolderId = folderId;
    setMessage(folderError, "");
    try {
        const folderData = await workspaceApi(
            `/api/workspace/folders/${encodeURIComponent(folderId)}`,
        );
        renderFolderContents(folderData);
        renderRootTiles();
    } catch (error) {
        showFolderError(error);
    }
}

async function refreshWorkspace() {
    setMessage(pageError, "");
    try {
        workspace = await workspaceApi("/api/workspace");
        renderRecentItems();
        if (!activeFolderId || !findFolder(activeFolderId)) {
            const defaultRoot = workspace.roots.find((root) => root.rootKey === "thesis_sections");
            activeFolderId = defaultRoot ? defaultRoot.id : workspace.roots[0].id;
        }
        renderRootTiles();
        await openFolder(activeFolderId);
    } catch (error) {
        showPageError(error);
    }
}

function showPageError(error) {
    setMessage(pageError, error instanceof Error ? error.message : "Unable to load the workspace.");
}

function showFolderError(error) {
    setMessage(folderError, error instanceof Error ? error.message : "Unable to load this folder.");
}

function makeField(labelText, input, hint) {
    dialogFieldSequence += 1;
    const field = createElement("div", "workspace-dialog-field");
    const label = createElement("label", "", labelText);
    const id = `workspace-dialog-field-${dialogFieldSequence}`;
    label.htmlFor = id;
    input.id = id;
    field.append(label, input);
    if (hint) {
        field.appendChild(createElement("span", "workspace-dialog-hint", hint));
    }
    dialogFields.appendChild(field);
    return input;
}

function makeTextInput(label, value = "", maxLength = 200) {
    const input = document.createElement("input");
    input.type = "text";
    input.name = "name";
    input.required = true;
    input.maxLength = maxLength;
    input.value = value;
    return makeField(label, input);
}

function makeNoteFields(name = "", text = "") {
    makeTextInput("Title", name);
    const textarea = document.createElement("textarea");
    textarea.name = "text";
    textarea.rows = 8;
    textarea.maxLength = 100000;
    textarea.value = text;
    makeField("Text", textarea, "Up to 100,000 characters.");
}

function openDialog(action) {
    dialogAction = action;
    dialogFields.replaceChildren();
    setMessage(dialogError, "");
    dialogSubmit.disabled = false;
    dialogFieldSequence = 0;

    if (action.type === "new-folder") {
        dialogTitle.textContent = "New folder";
        makeTextInput("Folder name", "", 100);
        dialogSubmit.textContent = "Create folder";
    } else if (action.type === "upload") {
        dialogTitle.textContent = "Upload file";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.name = "file";
        fileInput.accept = ".pdf,.docx,.txt";
        fileInput.required = true;
        makeField("Choose a PDF, DOCX, or TXT file", fileInput);
        dialogSubmit.textContent = "Upload";
    } else if (action.type === "new-note") {
        dialogTitle.textContent = "New note";
        makeNoteFields();
        dialogSubmit.textContent = "Create note";
    } else if (action.type === "edit-note") {
        dialogTitle.textContent = "Edit note";
        makeNoteFields(action.item.name, action.item.text);
        dialogSubmit.textContent = "Save note";
    } else if (action.type === "rename-folder" || action.type === "rename-item") {
        dialogTitle.textContent = action.type === "rename-folder" ? "Rename folder" : "Rename item";
        makeTextInput("Name", action.item.name, action.type === "rename-folder" ? 100 : 200);
        dialogSubmit.textContent = "Save name";
    }
    dialog.showModal();
    const firstInput = dialogFields.querySelector("input, textarea");
    if (firstInput) {
        firstInput.focus();
    }
}

function openRenameDialog(kind, item) {
    openDialog({
        type: kind === "folder" ? "rename-folder" : "rename-item",
        item,
    });
}

async function openEditNote(item) {
    try {
        const note = await workspaceApi(`/api/workspace/items/${encodeURIComponent(item.id)}`);
        openDialog({ type: "edit-note", item: note });
    } catch (error) {
        showPageError(error);
    }
}

async function submitDialog(event) {
    event.preventDefault();
    if (!dialogAction || !activeFolderId) {
        return;
    }
    setMessage(dialogError, "");
    const formData = new FormData(dialogForm);
    const name = String(formData.get("name") || "").trim();

    if (["new-folder", "rename-folder", "rename-item", "new-note", "edit-note"].includes(dialogAction.type)
        && !name) {
        setMessage(dialogError, "A name is required.");
        return;
    }
    if (dialogAction.type === "new-note" || dialogAction.type === "edit-note") {
        const text = String(formData.get("text") || "");
        if (Array.from(text).length > 100000) {
            setMessage(dialogError, "Note text must be 100,000 characters or fewer.");
            return;
        }
    }
    if (dialogAction.type === "upload") {
        const selectedFile = formData.get("file");
        if (!selectedFile || typeof selectedFile === "string" || !selectedFile.size) {
            setMessage(dialogError, "Choose a file to upload.");
            return;
        }
    }

    dialogSubmit.disabled = true;
    try {
        if (dialogAction.type === "new-folder") {
            await workspaceApi("/api/workspace/folders", {
                method: "POST",
                body: JSON.stringify({ parentId: activeFolderId, name }),
            });
        } else if (dialogAction.type === "upload") {
            formData.append("folderId", activeFolderId);
            await workspaceApi("/api/workspace/items/upload", {
                method: "POST",
                body: formData,
            });
        } else if (dialogAction.type === "new-note") {
            await workspaceApi("/api/workspace/items", {
                method: "POST",
                body: JSON.stringify({
                    folderId: activeFolderId,
                    name,
                    text: String(formData.get("text") || ""),
                }),
            });
        } else if (dialogAction.type === "edit-note") {
            await workspaceApi(`/api/workspace/items/${encodeURIComponent(dialogAction.item.id)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    name,
                    text: String(formData.get("text") || ""),
                }),
            });
        } else {
            const isFolder = dialogAction.type === "rename-folder";
            await workspaceApi(
                `/api/workspace/${isFolder ? "folders" : "items"}/${encodeURIComponent(dialogAction.item.id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ name }),
                },
            );
        }
        dialog.close();
        await refreshWorkspace();
    } catch (error) {
        setMessage(dialogError, error instanceof Error ? error.message : "Unable to save.");
    } finally {
        dialogSubmit.disabled = false;
    }
}

async function deleteItem(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) {
        return;
    }
    try {
        await workspaceApi(`/api/workspace/items/${encodeURIComponent(item.id)}`, {
            method: "DELETE",
        });
        await refreshWorkspace();
    } catch (error) {
        showPageError(error);
    }
}

async function deleteFolder(folder) {
    try {
        const preview = await workspaceApi(
            `/api/workspace/folders/${encodeURIComponent(folder.id)}/delete-preview`,
        );
        const message = `Delete "${folder.name}" and everything inside it?\n\n`
            + `${preview.folderCount} folder(s) and ${preview.itemCount} item(s) will be removed.`;
        if (!window.confirm(message)) {
            return;
        }
        await workspaceApi(`/api/workspace/folders/${encodeURIComponent(folder.id)}`, {
            method: "DELETE",
            body: JSON.stringify(preview),
        });
        await refreshWorkspace();
    } catch (error) {
        showPageError(error);
    }
}

addButton.addEventListener("click", () => {
    setAddMenuOpen(addMenu.hidden);
});

addMenu.addEventListener("click", (event) => {
    const action = event.target.closest("button[data-action]");
    if (!action) {
        return;
    }
    setAddMenuOpen(false);
    openDialog({ type: action.dataset.action });
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".workspace-add-wrap")) {
        setAddMenuOpen(false);
    }
});

dialogForm.addEventListener("submit", submitDialog);
document.getElementById("workspace-dialog-cancel").addEventListener("click", () => dialog.close());
document.getElementById("workspace-dialog-close").addEventListener("click", () => dialog.close());

refreshWorkspace();
