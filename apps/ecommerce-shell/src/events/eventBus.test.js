/**
 * Verifies a shell subscriber hears a published request and stops after unsubscribe.
 * Role: Locks subscribe and publish outcomes shared by both comparison branches.
 * Not in this file: The window dispatch or mesh send that carries the message.
 * Key dependencies: node:test; src/events/eventBus.js; test/support/installBrowserGlobals.js.
 * See also: src/events/eventBus.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../../test/support/installDomDocument.js";
import { createAccountEvents } from "@shared/account-events";
import { createCheckoutEvents } from "@shared/checkout-events";
import { createPageEvents } from "@shared/server-events";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const {
  ensureAccountIntentListeners,
  ensureCheckoutIntentListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishRenderRequested,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToCartChanges,
  subscribeToHeaderEvents,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} = await loadAppModule(new URL("./eventBus.js", import.meta.url).href);

test("a subscriber hears a render request, then stops hearing it after unsubscribe", () => {
  const renderRequests = [];
  const unsubscribe = subscribeToRenderRequests(() => {
    renderRequests.push("render");
  });

  publishRenderRequested();
  assert.deepEqual(renderRequests, ["render"]);

  unsubscribe();
  publishRenderRequested();
  assert.deepEqual(renderRequests, ["render"]);
});

test("an auth subscription can be removed, and a logout subscriber hears one request", () => {
  const logoutRequests = [];
  const unsubscribeSession = subscribeToAuthSessionChanges(() => {});
  const unsubscribeLogout = subscribeToLogoutRequests(() => {
    logoutRequests.push("logout");
  });
  publishAuthSessionChanged();
  publishLogoutRequested();
  unsubscribeSession();
  unsubscribeLogout();
  publishLogoutRequested();
  assert.deepEqual(logoutRequests, ["logout"]);
});

test("subscribeToCartChanges hears a cart change and receives no cart payload", () => {
  const receivedArguments = [];
  const unsubscribe = subscribeToCartChanges((...listenerArguments) => {
    receivedArguments.push(listenerArguments);
  });

  shellTransport.publish({
    topic: "cart",
    event: "changed",
    payload: { items: [{ productId: "p-01" }] },
    scope: "local",
  });
  unsubscribe();
  shellTransport.publish({
    topic: "cart",
    event: "changed",
    payload: {},
    scope: "local",
  });

  assert.deepEqual(receivedArguments, [[]]);
});

test("unsubscribing from the header returns a cleanup the caller can run", () => {
  const { root: headerElement } = installDomDocument();
  const unsubscribe = subscribeToHeaderEvents(headerElement, {
    onNavigate() {},
    onLogout() {},
  });
  assert.equal(typeof unsubscribe, "function");
  unsubscribe();
  unsubscribe();
});

test("header navigate and logout call the handlers they were given", () => {
  const { root: headerElement } = installDomDocument();
  const outcomes = [];
  const unsubscribe = subscribeToHeaderEvents(headerElement, {
    onNavigate() {
      outcomes.push("navigate");
    },
    onLogout() {
      outcomes.push("logout");
    },
  });

  headerElement.dispatchEvent({ type: "host:navigate" });
  headerElement.dispatchEvent({ type: "host:logout" });
  unsubscribe();

  assert.deepEqual(outcomes, ["navigate", "logout"]);
});

test("a profile or address save from the account remote reaches the shell's account handler", () => {
  const saves = [];
  ensureAccountIntentListeners({
    onProfileSaveRequested: (profile) => saves.push({ profile }),
    onAddressSaveRequested: (address) => saves.push({ address }),
  });
  const remoteAccountEvents = createAccountEvents(createPageEvents());
  const address = { street: "1 Main St", city: "Lisbon", state: "LX", postalCode: "1000", country: "PT" };

  remoteAccountEvents.publishProfileSaveRequested({ fullName: "Ada", gender: "female" });
  remoteAccountEvents.publishAddressSaveRequested(address);

  assert.deepEqual(saves, [{ profile: { fullName: "Ada", gender: "female" } }, { address }]);
});

test("a coupon or place-order request from the checkout remotes reaches the shell's checkout handler", () => {
  const requests = [];
  ensureCheckoutIntentListeners({
    onCouponApplied: (coupon) => requests.push(coupon),
    onPlaceOrderRequested: () => requests.push("place-order"),
  });
  const remoteCheckoutEvents = createCheckoutEvents(createPageEvents());

  remoteCheckoutEvents.publishCouponApplied({ code: "ten", discountPercentage: 10 });
  remoteCheckoutEvents.publishPlaceOrderRequested();

  assert.deepEqual(requests, [{ code: "ten", discountPercentage: 10 }, "place-order"]);
});
