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

    if (pageType === "support") {
        const searchInput = document.querySelector("[data-resource-search]");
        const status = document.querySelector("[data-resource-status]");
        const resourceSearch = globalThis.resourceSearch;

        if (!searchInput || !status) {
            throw new Error("The resource search controls are missing.");
        }
        if (!resourceSearch || typeof resourceSearch.getResourceSearchResults !== "function") {
            throw new Error("The resource search helper is unavailable.");
        }

        const renderResults = () => {
            const result = resourceSearch.getResourceSearchResults(resources, searchInput.value);

            list.replaceChildren();
            result.resources.forEach((resource) => {
                cardRenderer.renderResourceCard(resource, list);
            });

            status.hidden = !result.hasNoResults;
            list.hidden = result.hasNoResults;
        };

        searchInput.addEventListener("input", renderResults);
        renderResults();
        return;
    }

    resources.forEach((resource) => {
        cardRenderer.renderResourceCard(resource, list);
    });
}

renderResourcePage();
