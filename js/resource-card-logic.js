"use strict";

const resourceIconFiles = {
    pencil: "pencil.svg",
    book: "book.svg",
    users: "users.svg",
    "file-document": "file-document.svg",
    diamond: "diamond.svg",
};

function getResourceIconPath(iconKey) {
    if (!Object.prototype.hasOwnProperty.call(resourceIconFiles, iconKey)) {
        throw new TypeError(`Unsupported resource icon key: ${iconKey}`);
    }

    return `/js/resource-icons/${resourceIconFiles[iconKey]}`;
}

function getResourceLinkPresentation(url) {
    if (typeof url === "string" && url.trim() !== "") {
        return { href: url, isAvailable: true };
    }

    return { href: null, isAvailable: false };
}

const resourceCardLogicExports = {
    getResourceIconPath,
    getResourceLinkPresentation,
};

if (typeof module === "object" && module.exports) {
    module.exports = resourceCardLogicExports;
}

if (typeof globalThis === "object") {
    globalThis.resourceCardLogic = resourceCardLogicExports;
}
