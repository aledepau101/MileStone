const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getResourceIconPath,
  getResourceLinkPresentation,
} = require("../js/resource-card-logic.js");

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
    href: null,
    isAvailable: false,
  });
  assert.deepEqual(getResourceLinkPresentation("  "), {
    href: null,
    isAvailable: false,
  });
});

test("rejects unknown resource icon keys instead of substituting an icon", () => {
  assert.throws(() => getResourceIconPath("unknown"), {
    name: "TypeError",
    message: "Unsupported resource icon key: unknown",
  });
});
