/**
 * Publishes and subscribes to ecommerce cart Event Mesh messages.
 * Role: Hides cart mesh transport details behind ecommerce operations and lifecycle-safe subscriptions.
 * Not in this file: Shared auth/navigation events, cart state mutations, or UI rendering.
 * Key dependencies: event-mesh/mesh; @shared/shell-events; src/events/ecommerceEventContracts.js.
 * See also: src/main.js; src/pages/checkoutPage.js.
 */

import mesh from "event-mesh/mesh";
import { createShellEvents } from "@shared/shell-events";
import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  createCartSnapshot,
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

export {
  ensureCartEventListeners,
  publishCartChanged,
  publishCartItemAddRequested,
  resetCartEventListeners,
  subscribeToCartChanges,
};
export const {
  ensureShellEventListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishRenderRequested,
  resetShellEventListeners,
  subscribeToAuthSessionChanges,
} = sharedShellEvents;
