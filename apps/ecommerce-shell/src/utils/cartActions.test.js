/**
 * Verifies cart totals, local line edits, and stock-gated edits.
 * Role: Locks the cart math and the stock outcomes both comparison branches share.
 * Not in this file: The HTTP or mesh body of the shell transport.
 * Key dependencies: node:test; src/utils/cartActions.js; src/events/eventBus.js; src/notifications/notificationAdapter.js; test/support/createRecordingTransport.js; test/support/loadAppModule.js.
 * See also: src/utils/cartActions.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { installShellTransport, shellTransport: originalShellTransport } = await loadAppModule(
  new URL("../events/eventBus.js", import.meta.url).href,
);

const {
  STOCK_ISSUE_NOTIFICATION_MESSAGE,
  addCartItem,
  addCartItemWithStockCheck,
  calculateCartTotals,
  getCartDiscountedTotal,
  getCartItemCount,
  getCartTotalValue,
  reReserveGuestCartLines,
  removeCartItem,
  setCartItemQuantityWithStockCheck,
  updateCartItem,
} = await loadAppModule(new URL("./cartActions.js", import.meta.url).href);

const { subscribeToNotifications } = await loadAppModule(
  new URL("../notifications/notificationAdapter.js", import.meta.url).href,
);

/**
 * Runs one stock edit against a recording transport, then restores the shell binding.
 *
 * @param {{ requestReply?: object, requestReplies?: object[] }} script - Scripted request outcomes.
 * @param {(transport: ReturnType<typeof createRecordingTransport>) => Promise<void>} callback - Assertions for that transport.
 * @returns {Promise<void>}
 * @sideEffects Replaces and restores the shellTransport binding.
 */
async function withInstalledTransport(script, callback) {
  const transport = createRecordingTransport(script);
  installShellTransport(transport);
  try {
    await callback(transport);
  } finally {
    installShellTransport(originalShellTransport);
  }
}

/**
 * Builds shell cart state for one test.
 *
 * @param {object[]} cartItems - Lines already in the cart.
 * @param {string | null} authToken - Signed-in token, or null for a guest.
 * @returns {object} Shell state.
 */
function createCartState(cartItems, authToken = null) {
  return {
    authToken,
    cartItems,
    productsById: { mug: { name: "Mug", price: 10 } },
    appliedCoupon: { discountPercentage: 25 },
    currentUser: null,
  };
}

test("cart totals skip a missing product and apply the coupon", () => {
  const appState = createCartState([
    { productId: "mug", quantity: 2 },
    { productId: "gone", quantity: 4 },
  ]);

  assert.equal(getCartTotalValue(appState), 20);
  assert.equal(getCartItemCount(appState), 6);
  const totals = calculateCartTotals(appState);
  assert.equal(totals.subtotal, 20);
  assert.equal(totals.discountAmount, 5);
  assert.equal(totals.totalAmount, 15);
  assert.equal(getCartDiscountedTotal(appState), 15);

  appState.appliedCoupon = null;
  assert.equal(calculateCartTotals(appState).discountAmount, 0);
  assert.equal(calculateCartTotals(appState).totalAmount, 20);
});

test("local cart edits add, replace, and remove lines", () => {
  const appState = createCartState([]);

  addCartItem(appState, "mug", Number.NaN);
  assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 1 }]);

  addCartItem(appState, "mug", 2);
  assert.equal(appState.cartItems[0].quantity, 3);

  updateCartItem(appState, "poster", 4);
  assert.equal(appState.cartItems[1].quantity, 4);
  updateCartItem(appState, "poster", 1);
  assert.equal(appState.cartItems[1].quantity, 1);

  removeCartItem(appState, "mug");
  assert.deepEqual(appState.cartItems, [{ productId: "poster", quantity: 1 }]);
});

test("a rejected stock reservation leaves the cart unchanged", async () => {
  const appState = createCartState([{ productId: "mug", quantity: 1 }]);

  await withInstalledTransport({ requestReply: { ok: false, code: "insufficient" } }, async (transport) => {
    const result = await addCartItemWithStockCheck(appState, "lamp", 2);

    assert.deepEqual(result, { ok: false, code: "insufficient" });
    assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 1 }]);
    assert.equal(transport.published.length, 1);
    assert.equal(transport.published[0].topic, "stock");
    assert.equal(transport.published[0].event, "reserve");
    assert.equal(transport.published[0].payload.productId, "lamp");
    assert.equal(transport.published[0].payload.quantity, 2);
  });
});

test("a quantity of 0 removes the line after the server accepts the release", async () => {
  const appState = createCartState([{ productId: "mug", quantity: 2 }]);

  await withInstalledTransport(
    { requestReply: { ok: true, quantity: 0, available: 5 } },
    async (transport) => {
      const result = await setCartItemQuantityWithStockCheck(appState, "mug", 0);

      assert.equal(result.ok, true);
      assert.equal(result.quantity, 0);
      assert.deepEqual(appState.cartItems, []);
      assert.equal(transport.published[0].topic, "stock");
      assert.equal(transport.published[0].event, "set");
      assert.equal(transport.published[0].payload.quantity, 0);
    },
  );
});

test("a guest re-reserve drops a rejected line and publishes the stock notification once", async () => {
  const appState = createCartState([
    { productId: "mug", quantity: 1 },
    { productId: "lamp", quantity: 2 },
  ]);
  const notifications = [];
  const unsubscribe = subscribeToNotifications((notification) => {
    notifications.push(notification);
  });

  try {
    await withInstalledTransport(
      {
        requestReplies: [
          { ok: true, quantity: 1, available: 4 },
          { ok: false, code: "insufficient" },
        ],
      },
      async (transport) => {
        await reReserveGuestCartLines(appState);

        assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 1 }]);
        assert.equal(notifications.length, 1);
        assert.equal(notifications[0].message, STOCK_ISSUE_NOTIFICATION_MESSAGE);
        assert.deepEqual(
          transport.published.map((message) => message.event),
          ["set", "set"],
        );
      },
    );
  } finally {
    unsubscribe();
  }
});

test("a signed-in shopper and an empty guest cart skip guest re-reserve", async () => {
  await withInstalledTransport({}, async (transport) => {
    const signedInCart = createCartState([{ productId: "mug", quantity: 1 }], "token-01");
    await reReserveGuestCartLines(signedInCart);
    assert.deepEqual(signedInCart.cartItems, [{ productId: "mug", quantity: 1 }]);

    const emptyGuestCart = createCartState([]);
    await reReserveGuestCartLines(emptyGuestCart);
    assert.deepEqual(emptyGuestCart.cartItems, []);
    assert.equal(transport.published.length, 0);
  });
});

test("a signed-in add with no quantity adds one after the server grants it", async () => {
  const appState = createCartState([], "token-01");

  await withInstalledTransport({ requestReply: { ok: true, quantity: 1, available: 3 } }, async () => {
    const result = await addCartItemWithStockCheck(appState, "mug");

    assert.equal(result.ok, true);
    assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 1 }]);
  });
});

test("a stock edit sets the granted quantity, and a rejected one leaves the cart unchanged", async () => {
  const appState = createCartState([{ productId: "mug", quantity: 1 }]);

  await withInstalledTransport(
    {
      requestReplies: [
        { ok: true, quantity: 3, available: 2 },
        { ok: false, code: "insufficient" },
      ],
    },
    async () => {
      const granted = await setCartItemQuantityWithStockCheck(appState, "mug", 3);
      assert.equal(granted.ok, true);
      assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 3 }]);

      const rejected = await setCartItemQuantityWithStockCheck(appState, "mug", Number.NaN);
      assert.deepEqual(rejected, { ok: false, code: "insufficient" });
      assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 3 }]);
    },
  );
});
