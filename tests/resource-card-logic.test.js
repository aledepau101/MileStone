const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getResourceIconPath,
  getResourceLinkPresentation,
} = require("../js/resource-card-logic.js");

globalThis.resourceCardLogic = require("../js/resource-card-logic.js");
const { createResourceCard } = require("../js/resource-card.js");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
  }

  append(...elements) {
    this.children.push(...elements);
  }

  appendChild(element) {
    this.children.push(element);
    return element;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

test("provides local paths for the resource icon keys", () => {
  assert.equal(getResourceIconPath("pencil"), "/js/resource-icons/pencil.svg");
  assert.equal(getResourceIconPath("file-document"), "/js/resource-icons/file-document.svg");
  assert.equal(getResourceIconPath("diamond"), "/js/resource-icons/diamond.svg");
});

test("keeps a resource link available when a destination exists", () => {
  assert.deepEqual(
    getResourceLinkPresentation("https://example.edu/resources"),
    { href: "https://example.edu/resources", isAvailable: true },
  );
});

test("marks missing resource destinations as unavailable", () => {
  assert.deepEqual(getResourceLinkPresentation(null), {
    href: "#",
    isAvailable: false,
  });
  assert.deepEqual(getResourceLinkPresentation("  "), {
    href: "#",
    isAvailable: false,
  });
});

test("renders a resource with no destination as an anchor using the fallback href", () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
  };

  try {
    const card = createResourceCard({
      icon: "pencil",
      name: "Resource",
      description: "Description",
      tags: [],
      url: null,
    });
    const link = card.children[card.children.length - 1];

    assert.equal(link.tagName, "A");
    assert.equal(link.href, "#");
    assert.equal(link.textContent, "View Resources →");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("rejects unknown resource icon keys instead of substituting an icon", () => {
  assert.throws(() => getResourceIconPath("unknown"), {
    name: "TypeError",
    message: "Unsupported resource icon key: unknown",
  });
});
