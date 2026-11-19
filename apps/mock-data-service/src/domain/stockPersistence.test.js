/**
 * Verifies stock calls when the JSON store cannot be read or written.
 * Role: Locks the persistence failure codes and the product rows left in place.
 * Not in this file: Signed-in happy paths (src/domain/stockRequests.test.js) or HTTP routing.
 * Key dependencies: node:test; src/domain/stock.js; src/domain/guestHolds.js.
 * See also: src/domain/stock.js; src/domain/stockRequests.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { GUEST_HOLDS_PERSISTENCE_FAILED_CODE } = require("./guestHolds");
const { CART_PERSISTENCE_FAILED_CODE } = require("./cartProcessing");
const {
  STOCK_PERSISTENCE_FAILED_CODE,
  consumeStockForSale,
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

test("reserveAdditiveStock and consumeStockForSale return persistence failure and leave files unchanged", async () => {
  const readStore = createSignedInStore(5);
  readStore.readJsonFile = async function failRead() {
    throw new Error("disk unavailable");
  };

  const reserveResult = await reserveAdditiveStock({
    jsonStore: readStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 1,
  });

  assert.equal(reserveResult.ok, false);
  assert.equal(reserveResult.code, STOCK_PERSISTENCE_FAILED_CODE);
  const lampLine = readStore.files["carts.json"][0].items.find(
    (cartItem) => cartItem.productId === "p-01",
  );
  assert.equal(lampLine.quantity, 1);

  const writeStore = createSignedInStore(5);
  writeStore.writeJsonFile = async function failWrite() {
    throw new Error("disk full");
  };
  const saleResult = await consumeStockForSale({
    jsonStore: writeStore,
    items: [{ productId: "p-01", quantity: 1 }],
  });

  assert.equal(saleResult.ok, false);
  assert.equal(saleResult.code, STOCK_PERSISTENCE_FAILED_CODE);
  assert.equal(writeStore.files["products.json"][0].stock, 5);
});

test("consumeStockForSale and restoreStockForOrder treat a missing item list as no change", async () => {
  const jsonStore = createSignedInStore(5);

  const emptySale = await consumeStockForSale({ jsonStore, items: [] });
  const missingSale = await consumeStockForSale({ jsonStore, items: null });
  const emptyRestore = await restoreStockForOrder({ jsonStore, items: [] });
  const missingRestore = await restoreStockForOrder({ jsonStore, items: null });

  assert.deepEqual(emptySale, { ok: true, affectedProducts: [] });
  assert.deepEqual(missingSale, { ok: true, affectedProducts: [] });
  assert.deepEqual(emptyRestore, { ok: true, affectedProducts: [] });
  assert.deepEqual(missingRestore, { ok: true, affectedProducts: [] });
  assert.equal(jsonStore.files["products.json"][0].stock, 5);
});

test("releaseGuestSession returns the guest-hold failure when the hold file cannot be read", async () => {
  const jsonStore = createSignedInStore(5);
  jsonStore.readJsonFileWithDefault = async function failGuestHoldRead() {
    throw new Error("guest holds unreadable");
  };

  const releaseResult = await releaseGuestSession({
    jsonStore,
    sessionId: "guest-session-a",
  });

  assert.equal(releaseResult.ok, false);
  assert.equal(releaseResult.code, GUEST_HOLDS_PERSISTENCE_FAILED_CODE);
});

test("setAbsoluteStock returns persistence failure when the cart cannot be written", async () => {
  const jsonStore = createSignedInStore(5);
  jsonStore.writeJsonFile = async function failWrite() {
    throw new Error("disk full");
  };

  const setResult = await setAbsoluteStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 2,
  });

  assert.equal(setResult.ok, false);
  assert.equal(setResult.code, CART_PERSISTENCE_FAILED_CODE);
});

test("reserveAdditiveStock returns the guest-hold failure when guest holds are not an object", async () => {
  const jsonStore = createSignedInStore(5);
  jsonStore.files["guestHolds.json"] = [];

  const reserveResult = await reserveAdditiveStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 1,
  });

  assert.equal(reserveResult.ok, false);
  assert.equal(reserveResult.code, GUEST_HOLDS_PERSISTENCE_FAILED_CODE);
});

test("a sale or restore still reports the product when the later availability read fails", async () => {
  function failCartRead(jsonStore) {
    const readWithDefault = jsonStore.readJsonFileWithDefault.bind(jsonStore);
    jsonStore.readJsonFileWithDefault = async function readUnlessCarts(fileName, defaultValue) {
      if (fileName === "carts.json") {
        throw new Error("carts unreadable");
      }
      return readWithDefault(fileName, defaultValue);
    };
  }

  const saleStore = createSignedInStore(5);
  failCartRead(saleStore);
  const saleResult = await consumeStockForSale({
    jsonStore: saleStore,
    items: [{ productId: "p-01", quantity: 1 }],
  });
  assert.equal(saleResult.ok, true);
  assert.deepEqual(saleResult.affectedProducts, [{ productId: "p-01", available: 0 }]);

  const restoreStore = createSignedInStore(5);
  failCartRead(restoreStore);
  const restoreResult = await restoreStockForOrder({
    jsonStore: restoreStore,
    items: [{ productId: "p-01", quantity: 1 }],
  });
  assert.equal(restoreResult.ok, true);
  assert.deepEqual(restoreResult.affectedProducts, [{ productId: "p-01", available: 0 }]);
});
