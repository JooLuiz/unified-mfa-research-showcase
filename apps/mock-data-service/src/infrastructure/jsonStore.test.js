/**
 * Verifies the JSON file store against a temporary data directory.
 * Role: Exercises reads, writes, and the default fallback of jsonStore.js.
 * Not in this file: Route or domain behavior.
 * Key dependencies: node:test; node:fs; src/infrastructure/jsonStore.js.
 * See also: src/infrastructure/jsonStore.js.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createJsonStore } = require("./jsonStore");

/**
 * Creates an empty temporary data directory that is removed after the test.
 *
 * @param {import("node:test").TestContext} testContext - Test whose cleanup removes the directory.
 * @returns {string} Absolute directory path.
 */
function createTempDataDirectory(testContext) {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "json-store-"));
  testContext.after(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));
  return dataDirectory;
}

test("writeJsonFile and readJsonFile round-trip a value", async (testContext) => {
  const jsonStore = createJsonStore(createTempDataDirectory(testContext));

  await jsonStore.writeJsonFile("items.json", [{ id: "a" }]);

  assert.deepEqual(await jsonStore.readJsonFile("items.json"), [{ id: "a" }]);
});

test("readJsonFileWithDefault returns the default for a missing file", async (testContext) => {
  const jsonStore = createJsonStore(createTempDataDirectory(testContext));

  assert.deepEqual(await jsonStore.readJsonFileWithDefault("missing.json", []), []);
});

test("readJsonFileWithDefault rethrows an error other than a missing file", async (testContext) => {
  const dataDirectory = createTempDataDirectory(testContext);
  fs.mkdirSync(path.join(dataDirectory, "folder.json"));
  const jsonStore = createJsonStore(dataDirectory);

  await assert.rejects(() => jsonStore.readJsonFileWithDefault("folder.json", []), (error) => error.code !== "ENOENT");
});

test("readJsonFileWithDefault rethrows invalid JSON", async (testContext) => {
  const dataDirectory = createTempDataDirectory(testContext);
  fs.writeFileSync(path.join(dataDirectory, "broken.json"), "{not json", "utf8");
  const jsonStore = createJsonStore(dataDirectory);

  await assert.rejects(() => jsonStore.readJsonFileWithDefault("broken.json", []), SyntaxError);
});
