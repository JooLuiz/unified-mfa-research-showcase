/**
 * Verifies the shopper's coupon and place-order requests change the cart and toasts the same way.
 * Role: Locks each checkout request outcome on every comparison branch.
 * Not in this file: How a request reaches the shell, or the order HTTP call (src/commands/placeCheckoutOrder.test.js).
 * Key dependencies: node:test; src/intents/checkoutIntentHandlers.js; src/events/eventBus.js;
 *   test/support/createRecordingTransport.js; test/support/loadAppModule.js.
 * See also: src/intents/checkoutIntentHandlers.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const {
  installShellTransport,
  shellTransport: originalShellTransport,
  subscribeToCartChanges,
} = await loadAppModule(new URL("../events/eventBus.js", import.meta.url).href);
const { createCheckoutIntentHandlers } = await loadAppModule(
  new URL("./checkoutIntentHandlers.js", import.meta.url).href,
);

/**
 * Builds shopper state and handlers whose collaborators are recorded.
 *
 * @param {{ ok: boolean }} orderReply - Outcome the order step resolves to.
 * @returns {{ appState: object, handlers: object, calls: { orders: object[], notices: object[], cartChanges: number, persisted: object[] } }}
 */
function createShopperCheckout(orderReply = { ok: true }) {
  const appState = {
    authToken: "token-01",
    currentUser: { id: "user-01" },
    cartItems: [{ productId: "mug", quantity: 1 }],
    appliedCoupon: null,
  };
  const transport = createRecordingTransport();
  const calls = { orders: [], notices: [], cartChanges: 0, persisted: [] };
  const handlers = createCheckoutIntentHandlers(appState, {
    getTransport: () => transport,
    placeOrder: async (orderTransport, orderState) => {
      calls.orders.push({ orderTransport, orderState });
      return orderReply;
    },
    notify: (notice) => calls.notices.push(notice),
    announceCartChanged: () => {
      calls.cartChanges += 1;
    },
    persistCart: (persistedState) => calls.persisted.push(persistedState),
  });
  return { appState, handlers, transport, calls };
}

test("an applied coupon is kept on the cart, announced, and saved", () => {
  const { appState, handlers, calls } = createShopperCheckout();

  handlers.onCouponApplied({ code: "fifty", discountPercentage: 50 });

  assert.deepEqual(appState.appliedCoupon, { code: "fifty", discountPercentage: 50 });
  assert.equal(calls.cartChanges, 1);
  assert.deepEqual(calls.persisted, [appState]);
});

test("a placed order sends the shopper's cart and shows no error", async () => {
  const { appState, handlers, transport, calls } = createShopperCheckout({ ok: true });

  const outcome = await handlers.onPlaceOrderRequested();

  assert.deepEqual(outcome, { ok: true });
  assert.equal(calls.orders.length, 1);
  assert.equal(calls.orders[0].orderTransport, transport);
  assert.equal(calls.orders[0].orderState, appState);
  assert.deepEqual(calls.notices, []);
});

test("a failed order tells the shopper the cart is still available", async () => {
  const { handlers, calls } = createShopperCheckout({ ok: false });

  const outcome = await handlers.onPlaceOrderRequested();

  assert.deepEqual(outcome, { ok: false });
  assert.deepEqual(calls.notices, [
    {
      type: "error",
      title: "Order not placed",
      message: "Your cart is still available. Please try again.",
    },
  ]);
});

test("by default a coupon is announced to cart listeners and the order uses the installed transport", async () => {
  const guestState = { authToken: null, currentUser: null, cartItems: [], appliedCoupon: null };
  const installedTransport = createRecordingTransport();
  const orderTransports = [];
  let cartChanges = 0;
  const unsubscribe = subscribeToCartChanges(() => {
    cartChanges += 1;
  });
  installShellTransport(installedTransport);
  try {
    const handlers = createCheckoutIntentHandlers(guestState, {
      placeOrder: async (orderTransport) => {
        orderTransports.push(orderTransport);
        return { ok: true };
      },
    });

    handlers.onCouponApplied({ code: "ten", discountPercentage: 10 });
    await handlers.onPlaceOrderRequested();
  } finally {
    unsubscribe();
    installShellTransport(originalShellTransport);
  }

  assert.deepEqual(guestState.appliedCoupon, { code: "ten", discountPercentage: 10 });
  assert.equal(cartChanges, 1);
  assert.deepEqual(orderTransports, [installedTransport]);
});
