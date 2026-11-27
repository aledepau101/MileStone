const test = require("node:test");
const assert = require("node:assert/strict");
const { resources } = require("../js/resource-data.js");
const {
  filterResources,
  getResourceSearchResults,
} = require("../js/resource-search.js");

test("matches resource names", () => {
  assert.deepEqual(
    filterResources(resources, "Writing Resources Center").map((resource) => resource.id),
    ["writing-resources-center"],
  );
});

test("matches resource descriptions", () => {
  assert.deepEqual(
    filterResources(resources, "individualized feedback").map((resource) => resource.id),
    ["writing-resources-center"],
  );
});

test("matches any resource tag", () => {
  assert.deepEqual(
    filterResources(resources, "Scholarships").map((resource) => resource.id),
    ["graduate-funding-grants"],
  );
});

test("trims queries and matches case-insensitively", () => {
  assert.deepEqual(
    filterResources(resources, "  CITATION  ").map((resource) => resource.id),
    ["university-library-research-help", "citation-reference-help"],
  );
});

test("returns every resource for a whitespace-only filter query", () => {
  assert.deepEqual(filterResources(resources, "  \t\n"), resources);
});

test("returns an empty array when nothing matches", () => {
  assert.deepEqual(filterResources(resources, "zzzz"), []);
});

test("does not mutate the input resources", () => {
  const original = resources.slice();
  const results = filterResources(resources, "writing");

  assert.notStrictEqual(results, resources);
  assert.deepEqual(resources, original);
});

test("shows featured resources for an empty or whitespace-only page query", () => {
  for (const query of ["", "  "]) {
    const result = getResourceSearchResults(resources, query);

    assert.deepEqual(
      result.resources.map((resource) => resource.id),
      resources.filter((resource) => resource.featured).map((resource) => resource.id),
    );
    assert.equal(result.hasNoResults, false);
  }
});

test("finds a matching non-featured resource for a non-empty query", () => {
  const result = getResourceSearchResults(resources, "funding");

  assert.deepEqual(result.resources.map((resource) => resource.id), ["graduate-funding-grants"]);
  assert.equal(result.resources[0].featured, false);
  assert.equal(result.hasNoResults, false);
});

test("marks a non-empty query with no matches as no-results", () => {
  const result = getResourceSearchResults(resources, "zzzz");

  assert.deepEqual(result.resources, []);
  assert.equal(result.hasNoResults, true);
});
