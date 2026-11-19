/**
 * Verifies stock availability when catalog rows or cart rows are incomplete.
 * Role: Locks the counts returned when a read fails or a hold does not match a product.
 * Not in this file: Signed-in happy paths (src/domain/stockRequests.test.js) or write failures
 *   that leave a file unchanged (src/domain/stockPersistence.test.js).
 * Key dependencies: node:test; src/domain/stock.js; src/domain/cartProcessing.js.
 * See also: src/domain/stock.js; src/domain/stockPersistence.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { CART_PERSISTENCE_FAILED_CODE } = require("./cartProcessing");
const {
  STOCK_PERSISTENCE_FAILED_CODE,
  consumeStockForSale,
  getAvailableStockForProduct,
  getProductsWithAvailability,
  releaseGuestSession,
  reserveAdditiveStock,
  restoreStockForOrder,
  setAbsoluteStock,
} = require("./stock");

const SIGNED_IN_HOLDER = { type: "user", userId: "user-1" };

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

/**
 * Seeds a catalog and a signed-in cart that already holds one lamp.
 *
 * @param {number} lampStock - Units of p-01 on the product row.
 * @returns {ReturnType<typeof createMemoryJsonStore>} Store with products, carts, and guest holds.
 */
function createSignedInStore(lampStock) {
  return createMemoryJsonStore({
    "products.json": [
      { id: "p-01", name: "Minimalist Desk Lamp", price: 45, stock: lampStock },
      { id: "p-12", name: "Webcam Privacy Cover Set", price: 9.5, stock: 12 },
    ],
    "carts.json": [
      {
        userId: "user-1",
        items: [
          { productId: "p-01", quantity: 1 },
          { productId: "p-12", quantity: 1 },
        ],
        appliedCoupon: null,
      },
    ],
    "guestHolds.json": {},
  });
}

test("availability reads return persistence failure when the catalog cannot be read", async () => {
  const jsonStore = createSignedInStore(5);
  jsonStore.readJsonFile = async function failCatalogRead() {
    throw new Error("catalog unreadable");
  };

  const catalogResult = await getProductsWithAvailability(jsonStore);
  const availableResult = await getAvailableStockForProduct({
    jsonStore,
    productId: "p-01",
  });
  const setResult = await setAbsoluteStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 1,
  });
  const saleResult = await consumeStockForSale({
    jsonStore,
    items: [{ productId: "p-01", quantity: 1 }],
  });
  const restoreResult = await restoreStockForOrder({
    jsonStore,
    items: [{ productId: "p-01", quantity: 1 }],
  });

  assert.equal(catalogResult.code, STOCK_PERSISTENCE_FAILED_CODE);
  assert.equal(availableResult.code, STOCK_PERSISTENCE_FAILED_CODE);
  assert.equal(setResult.code, STOCK_PERSISTENCE_FAILED_CODE);
  assert.equal(saleResult.code, STOCK_PERSISTENCE_FAILED_CODE);
  assert.equal(restoreResult.code, STOCK_PERSISTENCE_FAILED_CODE);
});

test("a cart row without an item list still leaves the signed-in hold available", async () => {
  const jsonStore = createSignedInStore(5);
  jsonStore.files["carts.json"].push({
    userId: "user-2",
    items: null,
    appliedCoupon: null,
  });
  jsonStore.files["carts.json"].push({
    userId: "user-3",
    items: [{ productId: "p-12", quantity: 2 }],
    appliedCoupon: null,
  });

  const availableResult = await getAvailableStockForProduct({
    jsonStore,
    productId: "p-01",
  });

  assert.deepEqual(availableResult, { ok: true, available: 4 });
});

test("reserveAdditiveStock returns cart persistence failure when saved carts are not a list", async () => {
  const jsonStore = createSignedInStore(5);
  jsonStore.files["carts.json"] = { not: "an-array" };

  const reserveResult = await reserveAdditiveStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 1,
  });

  assert.equal(reserveResult.ok, false);
  assert.equal(reserveResult.code, CART_PERSISTENCE_FAILED_CODE);
});

test("releaseGuestSession reports zero available for a product that is not in the catalog", async () => {
  const jsonStore = createSignedInStore(5);
  jsonStore.files["guestHolds.json"] = {
    "guest-session-a": [{ productId: "p-missing", quantity: 1 }],
  };

  const releaseResult = await releaseGuestSession({
    jsonStore,
    sessionId: "guest-session-a",
  });

  assert.equal(releaseResult.ok, true);
  assert.deepEqual(releaseResult.affectedProducts, [
    { productId: "p-missing", available: 0 },
  ]);
});

test("releaseGuestSession reports no products when availability cannot be read after the hold is removed", async () => {
  const jsonStore = createSignedInStore(5);
  jsonStore.files["guestHolds.json"] = {
    "guest-session-a": [{ productId: "p-01", quantity: 1 }],
  };
  const readJsonFile = jsonStore.readJsonFile.bind(jsonStore);
  jsonStore.readJsonFile = async function failCatalogAfterHolds(fileName) {
    if (fileName === "products.json") {
      throw new Error("catalog unreadable");
    }
    return readJsonFile(fileName);
  };

  const releaseResult = await releaseGuestSession({
    jsonStore,
    sessionId: "guest-session-a",
  });

  assert.deepEqual(releaseResult, { ok: true, affectedProducts: [] });
});

test("consumeStockForSale treats a missing stock field as zero", async () => {
  const jsonStore = createSignedInStore(5);
  delete jsonStore.files["products.json"][0].stock;

  const saleResult = await consumeStockForSale({
    jsonStore,
    items: [{ productId: "p-01", quantity: 1 }],
  });

  assert.equal(saleResult.ok, true);
  assert.equal(jsonStore.files["products.json"][0].stock, 0);
});

test("restoreStockForOrder treats a missing stock field as zero before adding the line back", async () => {
  const jsonStore = createSignedInStore(5);
  delete jsonStore.files["products.json"][0].stock;

  const restoreResult = await restoreStockForOrder({
    jsonStore,
    items: [{ productId: "p-01", quantity: 2 }],
  });

  assert.equal(restoreResult.ok, true);
  assert.equal(jsonStore.files["products.json"][0].stock, 2);
});
