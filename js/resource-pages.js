"use strict";

function renderResourcePage() {
    const pageType = document.body.dataset.resourcePage;
    const list = document.querySelector("[data-resource-list]");
    const resources = globalThis.resourceData?.resources;
    const cardRenderer = globalThis.resourceCard;

    if (pageType !== "support" && pageType !== "all") {
        throw new TypeError(`Unsupported resource page type: ${pageType}`);
    }
    if (!list) {
        throw new Error("The resource card list container is missing.");
    }
    if (!Array.isArray(resources)) {
        throw new Error("The resource data is unavailable.");
    }
    if (!cardRenderer || typeof cardRenderer.renderResourceCard !== "function") {
        throw new Error("The resource card renderer is unavailable.");
    }

    const pageResources = pageType === "support"
        ? resources.filter((resource) => resource.featured)
        : resources;

    pageResources.forEach((resource) => {
        cardRenderer.renderResourceCard(resource, list);
    });
}

renderResourcePage();
