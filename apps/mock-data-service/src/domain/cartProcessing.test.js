/**
 * Verifies per-user cart persistence and cart removal when an order is stored.
 * Role: Exercises cartProcessing and the order-placement clear with an in-memory JSON store.
 * Not in this file: HTTP routing.
 * Key dependencies: node:test; src/domain/cartProcessing.js; src/domain/orderProcessing.js.
 * See also: src/domain/cartProcessing.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CART_REQUEST_INVALID_CODE,
  clearCartForUser,
  getCartForUser,
  saveCartForUser,
} = require("./cartProcessing");
const { createOrderForUser } = require("./orderProcessing");

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

test("getCartForUser returns an empty cart when the user has no row", async () => {
  const jsonStore = createMemoryJsonStore({ "carts.json": [] });
  const cartResult = await getCartForUser({ jsonStore, userId: "u-01" });
  assert.equal(cartResult.ok, true);
  assert.deepEqual(cartResult.cart.items, []);
  assert.equal(cartResult.cart.appliedCoupon, null);
});

test("saveCartForUser keeps one row per user and combines duplicate products", async () => {
  const jsonStore = createMemoryJsonStore({
    "carts.json": [
      {
        userId: "u-02",
        items: [{ productId: "p-09", quantity: 1 }],
        appliedCoupon: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const saveResult = await saveCartForUser({
    jsonStore,
    userId: "u-01",
    cartPayload: {
      items: [
        { productId: "p-01", quantity: 1 },
        { productId: "p-01", quantity: 2 },
      ],
      appliedCoupon: { code: "ten", discountPercentage: 10 },
    },
  });

  assert.equal(saveResult.ok, true);
  assert.deepEqual(saveResult.cart.items, [{ productId: "p-01", quantity: 3 }]);

  const storedCarts = jsonStore.files["carts.json"];
  assert.equal(storedCarts.length, 2);
  assert.equal(storedCarts.find((cartRecord) => cartRecord.userId === "u-02").items[0].productId, "p-09");

  const loadedCart = await getCartForUser({ jsonStore, userId: "u-01" });
  assert.equal(loadedCart.cart.appliedCoupon.code, "ten");
  assert.equal(loadedCart.cart.items[0].quantity, 3);
});

test("saveCartForUser rejects a fractional quantity and leaves the file unchanged", async () => {
  const jsonStore = createMemoryJsonStore({
    "carts.json": [
      {
        userId: "u-01",
        items: [{ productId: "p-01", quantity: 1 }],
        appliedCoupon: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const saveResult = await saveCartForUser({
    jsonStore,
    userId: "u-01",
    cartPayload: {
      items: [{ productId: "p-01", quantity: 1.5 }],
      appliedCoupon: null,
    },
  });

  assert.equal(saveResult.ok, false);
  assert.equal(saveResult.code, CART_REQUEST_INVALID_CODE);
  assert.equal(jsonStore.files["carts.json"][0].items[0].quantity, 1);
});

test("clearCartForUser removes only the requested user", async () => {
  const jsonStore = createMemoryJsonStore({
    "carts.json": [
      { userId: "u-01", items: [{ productId: "p-01", quantity: 1 }], appliedCoupon: null },
      { userId: "u-02", items: [{ productId: "p-02", quantity: 1 }], appliedCoupon: null },
    ],
  });

  const clearResult = await clearCartForUser({ jsonStore, userId: "u-01" });
  assert.equal(clearResult.ok, true);
  assert.deepEqual(
    jsonStore.files["carts.json"].map((cartRecord) => cartRecord.userId),
    ["u-02"],
  );
});

test("createOrderForUser removes the user cart only after the order is stored", async () => {
  const jsonStore = createMemoryJsonStore({
    "orders.json": [],
    "carts.json": [
      {
        userId: "u-01",
        items: [{ productId: "p-01", quantity: 2 }],
        appliedCoupon: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
  const user = { id: "u-01", address: null };

  const invalidOrder = await createOrderForUser({
    jsonStore,
    user,
    orderPayload: { items: [] },
  });
  assert.equal(invalidOrder.ok, false);
  assert.equal(jsonStore.files["carts.json"].length, 1);
  assert.equal(jsonStore.files["orders.json"].length, 0);

  const placedOrder = await createOrderForUser({
    jsonStore,
    user,
    orderPayload: {
      items: [{ productId: "p-01", name: "Minimalist Desk Lamp", quantity: 2, unitPrice: 45 }],
      subtotal: 90,
      discountAmount: 0,
      totalAmount: 90,
    },
  });
  assert.equal(placedOrder.ok, true);
  assert.equal(jsonStore.files["orders.json"].length, 1);
  assert.equal(jsonStore.files["carts.json"].length, 0);
});
