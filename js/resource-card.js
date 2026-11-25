"use strict";

const resourceCardLogic = globalThis.resourceCardLogic;

if (!resourceCardLogic) {
    throw new Error("Load js/resource-card-logic.js before js/resource-card.js.");
}

function createResourceCard(resource) {
    if (!resource || typeof resource !== "object") {
        throw new TypeError("A resource object is required.");
    }

    const card = document.createElement("article");
    card.className = "resource-card";

    const header = document.createElement("div");
    header.className = "resource-card__header";

    const icon = document.createElement("span");
    icon.className = "resource-card__icon";
    icon.setAttribute("aria-hidden", "true");

    const iconCircle = document.createElement("img");
    iconCircle.className = "resource-card__icon-circle";
    iconCircle.src = "/js/resource-icons/icon-circle.svg";
    iconCircle.alt = "";

    const iconImage = document.createElement("img");
    iconImage.className = `resource-card__icon-image resource-card__icon-image--${resource.icon}`;
    iconImage.src = resourceCardLogic.getResourceIconPath(resource.icon);
    iconImage.alt = "";

    icon.append(iconCircle, iconImage);

    const name = document.createElement("h3");
    name.className = "resource-card__name";
    name.textContent = resource.name;

    header.append(icon, name);

    const description = document.createElement("p");
    description.className = "resource-card__description";
    description.textContent = resource.description;

    const tags = document.createElement("ul");
    tags.className = "resource-card__tags";
    tags.setAttribute("aria-label", "Resource tags");

    resource.tags.forEach((tag) => {
        const tagItem = document.createElement("li");
        tagItem.className = "resource-card__tag";
        tagItem.textContent = tag;
        tags.appendChild(tagItem);
    });

    const linkPresentation = resourceCardLogic.getResourceLinkPresentation(resource.url);
    let resourceLink;

    if (linkPresentation.isAvailable) {
        resourceLink = document.createElement("a");
        resourceLink.href = linkPresentation.href;
        resourceLink.target = "_blank";
        resourceLink.rel = "noopener noreferrer";
    } else {
        resourceLink = document.createElement("span");
    }

    resourceLink.className = "resource-card__link";
    resourceLink.textContent = "View Resources →";

    card.append(header, description, tags, resourceLink);
    return card;
}

function renderResourceCard(resource, container) {
    if (!container || typeof container.appendChild !== "function") {
        throw new TypeError("A DOM container is required.");
    }

    const card = createResourceCard(resource);
    container.appendChild(card);
    return card;
}

const resourceCardExports = {
    createResourceCard,
    renderResourceCard,
};

if (typeof module === "object" && module.exports) {
    module.exports = resourceCardExports;
}

if (typeof globalThis === "object") {
    globalThis.resourceCard = resourceCardExports;
}
