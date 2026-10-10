/**
 * Verifies the live-stock rule: availability math, additive and absolute holds, guest-session
 * release, and stock consumption on a sale.
 * Role: Exercises stock.js with an in-memory JSON store.
 * Not in this file: HTTP routing.
 * Key dependencies: node:test; src/domain/stock.js.
 * See also: src/domain/stock.js; src/domain/cartProcessing.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  STOCK_INSUFFICIENT_CODE,
  getProductsWithAvailability,
  getAvailableStockForProduct,
  reserveAdditiveStock,
  setAbsoluteStock,
  releaseGuestSession,
  consumeStockForSale,
} = require("./stock");

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

function createBaseStore() {
  return createMemoryJsonStore({
    "products.json": [
      { id: "p-01", name: "Minimalist Desk Lamp", price: 45, stock: 2 },
      { id: "p-12", name: "Webcam Privacy Cover Set", price: 9.5, stock: 12 },
    ],
    "carts.json": [],
    "guestHolds.json": {},
  });
}

test("getProductsWithAvailability subtracts cart and guest holds from stock", async () => {
  const jsonStore = createMemoryJsonStore({
    "products.json": [{ id: "p-01", name: "Minimalist Desk Lamp", price: 45, stock: 2 }],
    "carts.json": [{ userId: "u-01", items: [{ productId: "p-01", quantity: 1 }], appliedCoupon: null }],
    "guestHolds.json": { "guest-session-a": [{ productId: "p-01", quantity: 1 }] },
  });

  const availabilityResult = await getProductsWithAvailability(jsonStore);
  assert.equal(availabilityResult.ok, true);
  assert.equal(availabilityResult.products[0].available, 0);
});

test("reserveAdditiveStock accepts a guest reservation within the available count", async () => {
  const jsonStore = createBaseStore();

  const reserveResult = await reserveAdditiveStock({
    jsonStore,
    holder: { type: "guest", sessionId: "guest-session-a" },
    productId: "p-01",
    quantity: 2,
  });

  assert.equal(reserveResult.ok, true);
  assert.equal(reserveResult.quantity, 2);
  assert.equal(reserveResult.available, 0);
  assert.deepEqual(jsonStore.files["guestHolds.json"]["guest-session-a"], [
    { productId: "p-01", quantity: 2 },
  ]);
});

test("reserveAdditiveStock rejects the whole request when it exceeds availability, leaving the hold unchanged", async () => {
  const jsonStore = createBaseStore();
  await reserveAdditiveStock({
    jsonStore,
    holder: { type: "user", userId: "u-01" },
    productId: "p-01",
    quantity: 1,
  });

  const rejectedResult = await reserveAdditiveStock({
    jsonStore,
    holder: { type: "guest", sessionId: "guest-session-a" },
    productId: "p-01",
    quantity: 2,
  });

  assert.equal(rejectedResult.ok, false);
  assert.equal(rejectedResult.code, STOCK_INSUFFICIENT_CODE);
  assert.equal(jsonStore.files["guestHolds.json"]["guest-session-a"], undefined);

  const availableResult = await getAvailableStockForProduct({ jsonStore, productId: "p-01" });
  assert.equal(availableResult.available, 1);
});

test("setAbsoluteStock caps a holder's line at their current quantity plus available", async () => {
  const jsonStore = createBaseStore();
  await reserveAdditiveStock({
    jsonStore,
    holder: { type: "user", userId: "u-01" },
    productId: "p-01",
    quantity: 1,
  });

  const rejectedResult = await setAbsoluteStock({
    jsonStore,
    holder: { type: "user", userId: "u-01" },
    productId: "p-01",
    quantity: 3,
  });
  assert.equal(rejectedResult.ok, false);
  assert.equal(rejectedResult.code, STOCK_INSUFFICIENT_CODE);

  const acceptedResult = await setAbsoluteStock({
    jsonStore,
    holder: { type: "user", userId: "u-01" },
    productId: "p-01",
    quantity: 2,
  });
  assert.equal(acceptedResult.ok, true);
  assert.equal(acceptedResult.quantity, 2);
  assert.equal(acceptedResult.available, 0);
});

test("setAbsoluteStock with quantity 0 removes the line and releases it", async () => {
  const jsonStore = createBaseStore();
  await reserveAdditiveStock({
    jsonStore,
    holder: { type: "user", userId: "u-01" },
    productId: "p-01",
    quantity: 2,
  });

  const removeResult = await setAbsoluteStock({
    jsonStore,
    holder: { type: "user", userId: "u-01" },
    productId: "p-01",
    quantity: 0,
  });

  assert.equal(removeResult.ok, true);
  assert.equal(removeResult.available, 2);
  assert.deepEqual(jsonStore.files["carts.json"][0].items, []);
});

test("releaseGuestSession deletes the session's holds and reports the recomputed availability", async () => {
  const jsonStore = createBaseStore();
  await reserveAdditiveStock({
    jsonStore,
    holder: { type: "guest", sessionId: "guest-session-a" },
    productId: "p-01",
    quantity: 2,
  });

  const releaseResult = await releaseGuestSession({ jsonStore, sessionId: "guest-session-a" });
  assert.equal(releaseResult.ok, true);
  assert.deepEqual(releaseResult.affectedProducts, [{ productId: "p-01", available: 2 }]);
  assert.equal(jsonStore.files["guestHolds.json"]["guest-session-a"], undefined);
});

test("releaseGuestSession is a no-op for a session with no holds", async () => {
  const jsonStore = createBaseStore();
  const releaseResult = await releaseGuestSession({ jsonStore, sessionId: "never-reserved" });
  assert.equal(releaseResult.ok, true);
  assert.deepEqual(releaseResult.affectedProducts, []);
});

test("consumeStockForSale decrements stock by the sold quantities", async () => {
  const jsonStore = createBaseStore();

  const saleResult = await consumeStockForSale({
    jsonStore,
    items: [{ productId: "p-01", quantity: 2 }],
  });

  assert.equal(saleResult.ok, true);
  assert.deepEqual(saleResult.affectedProducts, [{ productId: "p-01", available: 0 }]);
  assert.equal(jsonStore.files["products.json"][0].stock, 0);
});

test("consumeStockForSale never drives stock below zero", async () => {
  const jsonStore = createBaseStore();

  await consumeStockForSale({ jsonStore, items: [{ productId: "p-01", quantity: 5 }] });

  assert.equal(jsonStore.files["products.json"][0].stock, 0);
});
