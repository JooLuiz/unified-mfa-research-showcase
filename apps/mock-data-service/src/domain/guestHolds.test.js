/**
 * Verifies per-session guest hold reads, writes, and removal.
 * Role: Exercises guestHolds with an in-memory JSON store.
 * Not in this file: Availability math or HTTP routing.
 * Key dependencies: node:test; src/domain/guestHolds.js.
 * See also: src/domain/guestHolds.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  GUEST_HOLDS_PERSISTENCE_FAILED_CODE,
  deleteGuestHoldSession,
  getTotalGuestHoldQuantity,
  readGuestHoldsData,
  writeGuestHoldLine,
} = require("./guestHolds");

/**
 * Creates a JSON store whose files live in memory.
 *
 * @param {Record<string, unknown>} initialFiles - File name to stored JSON value.
 * @returns {{ readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void>, files: Record<string, unknown> }} In-memory store.
 */
function createMemoryJsonStore(initialFiles) {
  const files = structuredClone(initialFiles);
  return {
    files,
    async readJsonFile(fileName) {
      if (!Object.prototype.hasOwnProperty.call(files, fileName)) {
        const missingFileError = new Error(`Missing ${fileName}`);
        missingFileError.code = "ENOENT";
        throw missingFileError;
      }
      return structuredClone(files[fileName]);
    },
    async readJsonFileWithDefault(fileName, defaultValue) {
      try {
        return await this.readJsonFile(fileName);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          return structuredClone(defaultValue);
        }
        throw error;
      }
    },
    async writeJsonFile(fileName, data) {
      files[fileName] = structuredClone(data);
    },
  };
}

test("readGuestHoldsData rejects a file that is not a plain object", async () => {
  const jsonStore = createMemoryJsonStore({ "guestHolds.json": [] });
  const readResult = await readGuestHoldsData(jsonStore);
  assert.equal(readResult.ok, false);
  assert.equal(readResult.code, GUEST_HOLDS_PERSISTENCE_FAILED_CODE);
});

test("readGuestHoldsData reports persistence failure when the store throws", async () => {
  const jsonStore = createMemoryJsonStore({});
  jsonStore.readJsonFileWithDefault = async () => {
    throw new Error("unreadable");
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const readResult = await readGuestHoldsData(jsonStore);
    assert.equal(readResult.ok, false);
    assert.equal(readResult.code, GUEST_HOLDS_PERSISTENCE_FAILED_CODE);
  } finally {
    console.error = originalConsoleError;
  }
});

test("writeGuestHoldLine stores a line, replaces it, and removes the session at quantity 0", async () => {
  const jsonStore = createMemoryJsonStore({ "guestHolds.json": {} });

  const written = await writeGuestHoldLine({
    jsonStore,
    sessionId: "session-01",
    productId: "p-01",
    quantity: 2,
  });
  assert.equal(written.ok, true);
  assert.deepEqual(jsonStore.files["guestHolds.json"], {
    "session-01": [{ productId: "p-01", quantity: 2 }],
  });

  await writeGuestHoldLine({
    jsonStore,
    sessionId: "session-01",
    productId: "p-01",
    quantity: 4,
  });
  assert.deepEqual(jsonStore.files["guestHolds.json"]["session-01"], [
    { productId: "p-01", quantity: 4 },
  ]);

  await writeGuestHoldLine({
    jsonStore,
    sessionId: "session-01",
    productId: "p-01",
    quantity: 0,
  });
  assert.deepEqual(jsonStore.files["guestHolds.json"], {});
});

test("getTotalGuestHoldQuantity sums every session and deleteGuestHoldSession returns the removed lines", async () => {
  const jsonStore = createMemoryJsonStore({
    "guestHolds.json": {
      "session-01": [{ productId: "p-01", quantity: 2 }],
      "session-02": [
        { productId: "p-01", quantity: 1 },
        { productId: "p-02", quantity: 3 },
      ],
    },
  });
  const storedHolds = await readGuestHoldsData(jsonStore);
  assert.equal(getTotalGuestHoldQuantity(storedHolds.guestHolds, "p-01"), 3);

  const deleted = await deleteGuestHoldSession({ jsonStore, sessionId: "session-02" });
  assert.equal(deleted.ok, true);
  assert.deepEqual(deleted.removedLines, [
    { productId: "p-01", quantity: 1 },
    { productId: "p-02", quantity: 3 },
  ]);
  assert.deepEqual(Object.keys(jsonStore.files["guestHolds.json"]), ["session-01"]);

  const alreadyGone = await deleteGuestHoldSession({ jsonStore, sessionId: "session-09" });
  assert.deepEqual(alreadyGone, { ok: true, removedLines: [] });
});
