/**
 * Publishes and subscribes to shared catalog Event Mesh messages.
 * Role: Hides mesh transport details behind product-open and cart-add operations for remotes and shells.
 * Not in this file: Mesh configuration, cart state ownership, routing, or UI rendering.
 * Key dependencies: An Event Mesh client supplied by the owning shell (remotes must not configureMesh).
 * See also: src/catalogEventContracts.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import {
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_PRODUCT_OPEN_REQUESTED_EVENT,
  CATALOG_TOPIC,
  createCartAddRequest,
  isValidCartAddRequest,
  isValidProductOpenRequest,
} from "./catalogEventContracts.js";

/**
 * Creates a catalog-scoped local event adapter for product remotes and host shells.
 *
 * @param {{ mesh: { publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void } }} adapterInput - Configured mesh client for the owning shell.
 * @returns {{ publishProductOpenRequested: (productId: string) => void, publishCartItemAddRequested: (cartItem: { productId: string, quantity: number }) => void, ensureCatalogIntentListeners: (handlers: object) => void, resetCatalogIntentListeners: () => void }} Catalog event adapter.
 */
function createCatalogEvents({ mesh }) {
  let catalogIntentListenersStarted = false;

  function publishLocalEvent(topic, event, payload = {}) {
    mesh.publish({ topic, event, payload, scope: "local" });
  }

  /**
   * Publishes a request to open product details for a product id.
   *
   * @param {string} productId - Catalog product identifier.
   * @returns {void}
   * @sideEffects Publishes a local catalog.product-open-requested message.
   */
  function publishProductOpenRequested(productId) {
    if (typeof productId !== "string" || productId.trim() === "") {
      return;
    }

    publishLocalEvent(CATALOG_TOPIC, CATALOG_PRODUCT_OPEN_REQUESTED_EVENT, {
      productId,
    });
  }

  /**
   * Publishes a request for the host shell to add an item to its cart.
   *
   * @param {{ productId: string, quantity: number }} cartItem - Product and quantity to add.
   * @returns {void}
   * @sideEffects Publishes a local cart.item-add-requested message when the payload is valid.
   */
  function publishCartItemAddRequested(cartItem) {
    const normalizedRequest = createCartAddRequest(cartItem);
    if (!normalizedRequest) {
      return;
    }

    publishLocalEvent(
      CART_TOPIC,
      CART_ITEM_ADD_REQUESTED_EVENT,
      normalizedRequest,
    );
  }

  /**
   * Registers persistent catalog intent handlers after a mesh configuration change.
   *
   * @param {{ onProductOpenRequested: (payload: { productId: string }) => void, onCartItemAddRequested: (cartItem: { productId: string, quantity: number }) => void }} handlers - Host orchestration handlers.
   * @returns {void}
   * @sideEffects Registers two local mesh subscriptions.
   */
  function ensureCatalogIntentListeners(handlers) {
    if (catalogIntentListenersStarted) {
      return;
    }

    catalogIntentListenersStarted = true;
    mesh.subscribe(
      CATALOG_TOPIC,
      CATALOG_PRODUCT_OPEN_REQUESTED_EVENT,
      (message) => {
        if (isValidProductOpenRequest(message.payload)) {
          handlers.onProductOpenRequested(message.payload);
        }
      },
    );
    mesh.subscribe(CART_TOPIC, CART_ITEM_ADD_REQUESTED_EVENT, (message) => {
      if (isValidCartAddRequest(message.payload)) {
        handlers.onCartItemAddRequested(message.payload);
      }
    });
  }

  /**
   * Marks catalog intent subscriptions for re-registration after mesh.close() clears them.
   *
   * @returns {void}
   */
  function resetCatalogIntentListeners() {
    catalogIntentListenersStarted = false;
  }

  return {
    publishProductOpenRequested,
    publishCartItemAddRequested,
    ensureCatalogIntentListeners,
    resetCatalogIntentListeners,
  };
}

export { createCatalogEvents };
