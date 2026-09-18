/**
 * Publishes and subscribes to ecommerce Event Mesh messages.
 * Role: Hides cart, catalog-filter, and shared catalog-intent mesh transport behind ecommerce operations.
 * Not in this file: Shared auth/navigation event internals, cart state mutations, or UI rendering.
 * Key dependencies: event-mesh/mesh; @shared/shell-events; @shared/catalog-events; src/events/ecommerceEventContracts.js.
 * See also: src/main.js; src/pages/checkoutPage.js; src/utils/PLPFilterActions.js.
 */

import mesh from "event-mesh/mesh";
import { createShellEvents } from "@shared/shell-events";
import { createCatalogEvents } from "@shared/catalog-events";
import {
  CART_CHANGED_EVENT,
  CART_TOPIC,
  CATALOG_FILTERS_CHANGED_EVENT,
  CATALOG_TOPIC,
  createCartSnapshot,
  createPlpFiltersSnapshot,
} from "./ecommerceEventContracts";

const sharedShellEvents = createShellEvents({ mesh });
const sharedCatalogEvents = createCatalogEvents({ mesh });
let cartChangedListenersStarted = false;

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
 * Registers persistent cart.changed handlers after a mesh configuration change.
 *
 * @param {{ onCartChanged: () => void }} handlers - Cart orchestration handlers.
 * @returns {void}
 * @sideEffects Registers a local cart.changed mesh subscription.
 */
function ensureCartEventListeners(handlers) {
  if (cartChangedListenersStarted) {
    return;
  }

  cartChangedListenersStarted = true;
  mesh.subscribe(CART_TOPIC, CART_CHANGED_EVENT, () => {
    handlers.onCartChanged();
  });
}

/**
 * Marks cart.changed subscriptions for re-registration after mesh.close() clears them.
 *
 * @returns {void}
 */
function resetCartEventListeners() {
  cartChangedListenersStarted = false;
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
  publishPlpFiltersChanged,
  resetCartEventListeners,
  subscribeToCartChanges,
  subscribeToPlpFiltersChanges,
};
export const {
  ensureCatalogIntentListeners,
  publishCartItemAddRequested,
  publishProductOpenRequested,
  resetCatalogIntentListeners,
} = sharedCatalogEvents;
export const {
  ensureShellEventListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishRenderRequested,
  resetShellEventListeners,
  subscribeToAuthSessionChanges,
} = sharedShellEvents;
