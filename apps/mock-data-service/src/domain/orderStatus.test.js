/**
 * Verifies the order lifecycle: allowed transitions, actor checks, and stock restore on cancel.
 * Role: Exercises orderStatus.js with an in-memory JSON store.
 * Not in this file: HTTP routing.
 * Key dependencies: node:test; src/domain/orderStatus.js.
 * See also: src/domain/orderStatus.js; src/domain/stock.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ORDER_STATUS_INVALID_TRANSITION_CODE,
  ORDER_STATUS_NOT_ALLOWED_CODE,
  applyOrderStatusChange,
  resolveOrderStatus,
} = require("./orderStatus");

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

function createStoreWithOrder(order) {
  return createMemoryJsonStore({
    "products.json": [{ id: "p-01", name: "Minimalist Desk Lamp", price: 45, stock: 2 }],
    "carts.json": [],
    "guestHolds.json": {},
    "orders.json": [order],
  });
}

function placedOrder(status) {
  const order = {
    id: "order-01",
    userId: "u-01",
    items: [{ productId: "p-01", quantity: 1 }],
  };
  if (status) {
    order.status = status;
  }
  return order;
}

test("resolveOrderStatus treats a missing status as placed", () => {
  assert.equal(resolveOrderStatus({ id: "order-01" }), "placed");
  assert.equal(resolveOrderStatus({ status: "shipped" }), "shipped");
});

test("applyOrderStatusChange allows every admin and customer transition", async () => {
  const transitions = [
    { from: "placed", to: "shipped", actor: "admin" },
    { from: "shipped", to: "delivered", actor: "admin" },
    { from: "placed", to: "cancellation-requested", actor: "customer" },
    { from: "cancellation-requested", to: "placed", actor: "admin" },
  ];

  for (const transition of transitions) {
    const jsonStore = createStoreWithOrder(placedOrder(transition.from));
    const changeResult = await applyOrderStatusChange({
      jsonStore,
      order: jsonStore.files["orders.json"][0],
      nextStatus: transition.to,
      actor: transition.actor,
    });
    assert.equal(changeResult.ok, true, `${transition.from} -> ${transition.to}`);
    assert.equal(changeResult.order.status, transition.to);
    assert.deepEqual(changeResult.stockAvailability, []);
    assert.equal(jsonStore.files["products.json"][0].stock, 2);
  }
});

test("applyOrderStatusChange ships an order that has no stored status", async () => {
  const jsonStore = createStoreWithOrder(placedOrder());
  const changeResult = await applyOrderStatusChange({
    jsonStore,
    order: jsonStore.files["orders.json"][0],
    nextStatus: "shipped",
    actor: "admin",
  });
  assert.equal(changeResult.ok, true);
  assert.equal(changeResult.order.status, "shipped");
});

test("applyOrderStatusChange rejects a customer who tries to ship", async () => {
  const jsonStore = createStoreWithOrder(placedOrder("placed"));
  const changeResult = await applyOrderStatusChange({
    jsonStore,
    order: jsonStore.files["orders.json"][0],
    nextStatus: "shipped",
    actor: "customer",
  });
  assert.deepEqual(changeResult, { ok: false, code: ORDER_STATUS_NOT_ALLOWED_CODE });
  assert.equal(jsonStore.files["products.json"][0].stock, 2);
});

test("applyOrderStatusChange rejects shipping an order that is waiting on a cancellation request", async () => {
  const jsonStore = createStoreWithOrder(placedOrder("cancellation-requested"));
  const changeResult = await applyOrderStatusChange({
    jsonStore,
    order: jsonStore.files["orders.json"][0],
    nextStatus: "shipped",
    actor: "admin",
  });
  assert.deepEqual(changeResult, { ok: false, code: ORDER_STATUS_INVALID_TRANSITION_CODE });
  assert.equal(jsonStore.files["orders.json"][0].status, "cancellation-requested");
});

test("applyOrderStatusChange restores stock when an admin cancels a placed order", async () => {
  const jsonStore = createStoreWithOrder(placedOrder("placed"));
  const changeResult = await applyOrderStatusChange({
    jsonStore,
    order: jsonStore.files["orders.json"][0],
    nextStatus: "cancelled",
    actor: "admin",
  });
  assert.equal(changeResult.ok, true);
  assert.equal(changeResult.order.status, "cancelled");
  assert.deepEqual(changeResult.stockAvailability, [{ productId: "p-01", available: 3 }]);
  assert.equal(jsonStore.files["products.json"][0].stock, 3);
});

test("applyOrderStatusChange restores stock when an admin accepts a cancellation request", async () => {
  const jsonStore = createStoreWithOrder(placedOrder("cancellation-requested"));
  const changeResult = await applyOrderStatusChange({
    jsonStore,
    order: jsonStore.files["orders.json"][0],
    nextStatus: "cancelled",
    actor: "admin",
  });
  assert.equal(changeResult.ok, true);
  assert.equal(jsonStore.files["products.json"][0].stock, 3);
});

test("applyOrderStatusChange leaves stock unchanged when a customer requests cancellation", async () => {
  const jsonStore = createStoreWithOrder(placedOrder("placed"));
  const requestResult = await applyOrderStatusChange({
    jsonStore,
    order: jsonStore.files["orders.json"][0],
    nextStatus: "cancellation-requested",
    actor: "customer",
  });
  assert.equal(requestResult.ok, true);
  assert.equal(jsonStore.files["products.json"][0].stock, 2);

  const declineResult = await applyOrderStatusChange({
    jsonStore,
    order: requestResult.order,
    nextStatus: "placed",
    actor: "admin",
  });
  assert.equal(declineResult.ok, true);
  assert.equal(declineResult.order.status, "placed");
  assert.equal(jsonStore.files["products.json"][0].stock, 2);
});
