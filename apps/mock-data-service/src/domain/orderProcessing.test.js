/**
 * Verifies order persistence, cart clearing, and stock decrement for a placed order.
 * Role: Exercises createOrderForUser with an in-memory JSON store.
 * Not in this file: HTTP routing or later status changes.
 * Key dependencies: node:test; src/domain/orderProcessing.js.
 * See also: src/domain/orderProcessing.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ORDER_PERSISTENCE_FAILED_CODE,
  ORDER_REQUEST_INVALID_CODE,
  createOrderForUser,
} = require("./orderProcessing");

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

function createOrderStore() {
  return createMemoryJsonStore({
    "orders.json": [],
    "carts.json": [
      {
        userId: "u-01",
        items: [{ productId: "p-01", quantity: 2 }],
        appliedCoupon: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    "products.json": [{ id: "p-01", name: "Desk Lamp", price: 45, stock: 5 }],
    "guestHolds.json": {},
  });
}

test("createOrderForUser rejects an order with no items and leaves stored files unchanged", async () => {
  const jsonStore = createOrderStore();
  const orderResult = await createOrderForUser({
    jsonStore,
    user: { id: "u-01", address: null },
    orderPayload: { items: [] },
  });

  assert.equal(orderResult.ok, false);
  assert.equal(orderResult.code, ORDER_REQUEST_INVALID_CODE);
  assert.equal(jsonStore.files["orders.json"].length, 0);
  assert.equal(jsonStore.files["carts.json"].length, 1);
  assert.equal(jsonStore.files["products.json"][0].stock, 5);
});

test("createOrderForUser stores the order, clears the cart, and returns the remaining stock", async () => {
  const jsonStore = createOrderStore();
  const shippingAddress = { street: "Av. Paulista 1000", city: "São Paulo" };
  const orderResult = await createOrderForUser({
    jsonStore,
    user: { id: "u-01", address: { street: "Fallback" } },
    orderPayload: {
      items: [{ productId: "p-01", name: "Desk Lamp", quantity: 2, unitPrice: 45 }],
      subtotal: 90,
      discountAmount: 0,
      totalAmount: 90,
      shippingAddress,
    },
  });

  assert.equal(orderResult.ok, true);
  assert.equal(orderResult.order.userId, "u-01");
  assert.equal(orderResult.order.status, "placed");
  assert.deepEqual(orderResult.order.shippingAddress, shippingAddress);
  assert.deepEqual(orderResult.stockAvailability, [{ productId: "p-01", available: 3 }]);
  assert.equal(jsonStore.files["orders.json"].length, 1);
  assert.equal(jsonStore.files["orders.json"][0].id, orderResult.order.id);
  assert.equal(jsonStore.files["carts.json"].length, 0);
  assert.equal(jsonStore.files["products.json"][0].stock, 3);
});

test("createOrderForUser uses the account address when the payload has none", async () => {
  const jsonStore = createOrderStore();
  const accountAddress = { street: "45 Queen Street", city: "Toronto" };
  const orderResult = await createOrderForUser({
    jsonStore,
    user: { id: "u-01", address: accountAddress },
    orderPayload: {
      items: [{ productId: "p-01", quantity: 1 }],
      subtotal: 45,
      totalAmount: 45,
    },
  });

  assert.equal(orderResult.ok, true);
  assert.deepEqual(orderResult.order.shippingAddress, accountAddress);
});

test("createOrderForUser reports persistence failure when the order file cannot be written", async () => {
  const jsonStore = createOrderStore();
  jsonStore.writeJsonFile = async () => {
    throw new Error("disk full");
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const orderResult = await createOrderForUser({
      jsonStore,
      user: { id: "u-01", address: null },
      orderPayload: {
        items: [{ productId: "p-01", quantity: 1 }],
        totalAmount: 45,
      },
    });

    assert.equal(orderResult.ok, false);
    assert.equal(orderResult.code, ORDER_PERSISTENCE_FAILED_CODE);
    assert.equal(jsonStore.files["carts.json"].length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});
