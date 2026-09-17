/**
 * Publishes and subscribes to ecommerce Event Mesh messages.
 * Role: Hides cart and catalog mesh transport details behind ecommerce operations and lifecycle-safe subscriptions.
 * Not in this file: Shared auth/navigation event internals, cart state mutations, or UI rendering.
 * Key dependencies: event-mesh/mesh; @shared/shell-events; src/events/ecommerceEventContracts.js.
 * See also: src/main.js; src/pages/checkoutPage.js; src/utils/PLPFilterActions.js.
 */

import mesh from "event-mesh/mesh";
import { createShellEvents } from "@shared/shell-events";
import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_FILTERS_CHANGED_EVENT,
  CATALOG_TOPIC,
  createCartSnapshot,
  createPlpFiltersSnapshot,
  isValidCartAddRequest,
} from "./ecommerceEventContracts";

const sharedShellEvents = createShellEvents({ mesh });
let cartEventListenersStarted = false;

/**
 * Publishes a request for the shell to add an item to its cart.
 *
 * @param {{ productId: string, quantity: number }} cartItem - Product and quantity to add.
 * @returns {void}
 * @sideEffects Publishes a local cart.item-add-requested message.
 */
function publishCartItemAddRequested(cartItem) {
  mesh.publish({
    topic: CART_TOPIC,
    event: CART_ITEM_ADD_REQUESTED_EVENT,
    payload: cartItem,
    scope: "local",
  });
}

/**
 * Publishes the current cart state as an immutable-by-convention snapshot.
 *
 * @param {unknown[]} cartItems - Cart items owned by the ecommerce shell.
 * @returns {void}
 * @sideEffects Publishes a local cart.changed message.
 */
function publishCartChanged(cartItems) {
  mesh.publish({
    topic: CART_TOPIC,
    event: CART_CHANGED_EVENT,
    payload: { items: createCartSnapshot(cartItems) },
    scope: "local",
  });
}

/**
 * Publishes the current PLP filter snapshot for local subscribers.
 *
 * @param {unknown} filters - PLP filter object owned by the ecommerce shell.
 * @returns {void}
 * @sideEffects Publishes a local catalog.filters-changed message.
 * @note localStorage remains the reload cache; this event is live coordination only.
 */
function publishPlpFiltersChanged(filters) {
  mesh.publish({
    topic: CATALOG_TOPIC,
    event: CATALOG_FILTERS_CHANGED_EVENT,
    payload: createPlpFiltersSnapshot(filters),
    scope: "local",
  });
}

/**
 * Registers persistent ecommerce cart handlers after a mesh configuration change.
 *
 * @param {{ onCartItemAddRequested: (cartItem: { productId: string, quantity: number }) => void, onCartChanged: () => void }} handlers - Cart orchestration handlers.
 * @returns {void}
 * @sideEffects Registers two local cart mesh subscriptions.
 */
function ensureCartEventListeners(handlers) {
  if (cartEventListenersStarted) {
    return;
  }

  cartEventListenersStarted = true;
  mesh.subscribe(CART_TOPIC, CART_ITEM_ADD_REQUESTED_EVENT, (message) => {
    if (isValidCartAddRequest(message.payload)) {
      handlers.onCartItemAddRequested(message.payload);
    }
  });
  mesh.subscribe(CART_TOPIC, CART_CHANGED_EVENT, () => {
    handlers.onCartChanged();
  });
}

/**
 * Marks cart subscriptions for re-registration after mesh.close() clears them.
 *
 * @returns {void}
 */
function resetCartEventListeners() {
  cartEventListenersStarted = false;
}

/**
 * Subscribes a mounted remote to cart snapshots without exposing Event Mesh to it.
 *
 * @param {(cartItems: { productId: string, quantity: number }[]) => void} listener - Callback for each cart snapshot.
 * @returns {() => void} Removes the mesh subscription when the remote unmounts.
 * @sideEffects Registers a local cart.changed mesh subscription.
 */
function subscribeToCartChanges(listener) {
  return mesh.subscribe(CART_TOPIC, CART_CHANGED_EVENT, (message) => {
    listener(createCartSnapshot(message.payload?.items));
  });
}

/**
 * Subscribes to PLP filter snapshots without exposing Event Mesh to the caller.
 *
 * @param {(filters: { searchQuery: string, minPrice: string, maxPrice: string, categoryIds: string[] }) => void} listener - Callback for each filter snapshot.
 * @returns {() => void} Removes the mesh subscription.
 * @sideEffects Registers a local catalog.filters-changed mesh subscription.
 */
function subscribeToPlpFiltersChanges(listener) {
  return mesh.subscribe(
    CATALOG_TOPIC,
    CATALOG_FILTERS_CHANGED_EVENT,
    (message) => {
      listener(createPlpFiltersSnapshot(message.payload));
    },
  );
}

export {
  ensureCartEventListeners,
  publishCartChanged,
  publishCartItemAddRequested,
  publishPlpFiltersChanged,
  resetCartEventListeners,
  subscribeToCartChanges,
  subscribeToPlpFiltersChanges,
};
export const {
  ensureShellEventListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishRenderRequested,
  resetShellEventListeners,
  subscribeToAuthSessionChanges,
} = sharedShellEvents;
