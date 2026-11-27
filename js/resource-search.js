"use strict";

function filterResources(resources, query) {
    if (!Array.isArray(resources)) {
        throw new TypeError("Resources must be an array.");
    }
    if (typeof query !== "string") {
        throw new TypeError("The resource search query must be a string.");
    }

    const normalizedQuery = query.trim().toLowerCase();
    return resources.filter((resource) => {
        if (normalizedQuery === "") {
            return true;
        }

        const searchableFields = [
            resource.name,
            resource.description,
            ...(Array.isArray(resource.tags) ? resource.tags : []),
        ];
        return searchableFields.some((field) =>
            typeof field === "string" && field.toLowerCase().includes(normalizedQuery));
    });
}

function getResourceSearchResults(resources, query) {
    if (!Array.isArray(resources)) {
        throw new TypeError("Resources must be an array.");
    }
    if (typeof query !== "string") {
        throw new TypeError("The resource search query must be a string.");
    }

    const normalizedQuery = query.trim();
    const results = normalizedQuery === ""
        ? resources.filter((resource) => resource.featured)
        : filterResources(resources, normalizedQuery);

    return {
        resources: results,
        hasNoResults: normalizedQuery !== "" && results.length === 0,
    };
}

const resourceSearchExports = { filterResources, getResourceSearchResults };

if (typeof module === "object" && module.exports) {
    module.exports = resourceSearchExports;
}

if (typeof globalThis === "object") {
    globalThis.resourceSearch = resourceSearchExports;
}
