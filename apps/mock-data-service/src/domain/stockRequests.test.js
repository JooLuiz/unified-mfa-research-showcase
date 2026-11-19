/**
 * Verifies signed-in stock holds and rejected stock requests.
 * Role: Locks the stock return codes and the cart rows those calls leave behind.
 * Not in this file: Store read and write failures (src/domain/stockPersistence.test.js) or HTTP routing.
 * Key dependencies: node:test; src/domain/stock.js.
 * See also: src/domain/stock.js; src/domain/stockPersistence.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  STOCK_INSUFFICIENT_CODE,
  STOCK_REQUEST_INVALID_CODE,
  getAvailableStockForProduct,
  reserveAdditiveStock,
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

test("reserveAdditiveStock adds a signed-in quantity onto the saved cart row", async () => {
  const jsonStore = createSignedInStore(5);

  const reserveResult = await reserveAdditiveStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 1,
  });

  assert.equal(reserveResult.ok, true);
  assert.equal(reserveResult.quantity, 2);
  assert.equal(reserveResult.available, 3);
  const lampLine = jsonStore.files["carts.json"][0].items.find(
    (cartItem) => cartItem.productId === "p-01",
  );
  assert.deepEqual(lampLine, { productId: "p-01", quantity: 2 });
});

test("reserveAdditiveStock rejects a signed-in quantity above availability and leaves the cart row", async () => {
  const jsonStore = createSignedInStore(5);

  const reserveResult = await reserveAdditiveStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 5,
  });

  assert.equal(reserveResult.ok, false);
  assert.equal(reserveResult.code, STOCK_INSUFFICIENT_CODE);
  const lampLine = jsonStore.files["carts.json"][0].items.find(
    (cartItem) => cartItem.productId === "p-01",
  );
  assert.equal(lampLine.quantity, 1);
});

test("reserveAdditiveStock rejects a blank id, a zero quantity, and an unknown product", async () => {
  const jsonStore = createSignedInStore(5);

  const blankProductResult = await reserveAdditiveStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: " ",
    quantity: 1,
  });
  const zeroQuantityResult = await reserveAdditiveStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 0,
  });
  const unknownProductResult = await reserveAdditiveStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-missing",
    quantity: 1,
  });

  assert.equal(blankProductResult.code, STOCK_REQUEST_INVALID_CODE);
  assert.equal(zeroQuantityResult.code, STOCK_REQUEST_INVALID_CODE);
  assert.equal(unknownProductResult.code, STOCK_REQUEST_INVALID_CODE);
  const lampLine = jsonStore.files["carts.json"][0].items.find(
    (cartItem) => cartItem.productId === "p-01",
  );
  assert.equal(lampLine.quantity, 1);
});

test("setAbsoluteStock replaces a signed-in line and quantity 0 removes only that line", async () => {
  const jsonStore = createSignedInStore(5);

  const replaceResult = await setAbsoluteStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 3,
  });
  assert.equal(replaceResult.ok, true);
  assert.equal(replaceResult.quantity, 3);

  const removeResult = await setAbsoluteStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: 0,
  });

  assert.equal(removeResult.ok, true);
  assert.deepEqual(jsonStore.files["carts.json"][0].items, [
    { productId: "p-12", quantity: 1 },
  ]);
});

test("getAvailableStockForProduct returns the free count or rejects an unknown id", async () => {
  const jsonStore = createSignedInStore(5);

  const availableResult = await getAvailableStockForProduct({
    jsonStore,
    productId: "p-01",
  });
  const unknownResult = await getAvailableStockForProduct({
    jsonStore,
    productId: "p-missing",
  });

  assert.deepEqual(availableResult, { ok: true, available: 4 });
  assert.equal(unknownResult.ok, false);
  assert.equal(unknownResult.code, STOCK_REQUEST_INVALID_CODE);
});

test("setAbsoluteStock rejects a negative quantity and an unknown product", async () => {
  const jsonStore = createSignedInStore(5);

  const negativeResult = await setAbsoluteStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-01",
    quantity: -1,
  });
  const unknownResult = await setAbsoluteStock({
    jsonStore,
    holder: SIGNED_IN_HOLDER,
    productId: "p-missing",
    quantity: 1,
  });

  assert.equal(negativeResult.code, STOCK_REQUEST_INVALID_CODE);
  assert.equal(unknownResult.code, STOCK_REQUEST_INVALID_CODE);
});
