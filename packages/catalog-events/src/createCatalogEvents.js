/**
 * Publishes and subscribes to shared catalog Event Mesh messages.
 * Role: Hides mesh transport details behind catalog and cart intent operations for remotes and shells.
 * Not in this file: Mesh configuration, cart state ownership, routing, or UI rendering.
 * Key dependencies: An Event Mesh client supplied by the owning shell (remotes must not configureMesh).
 * See also: src/catalogEventContracts.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import {
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_ITEM_REMOVE_REQUESTED_EVENT,
  CART_ITEM_UPDATE_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_FILTERS_APPLY_REQUESTED_EVENT,
  CATALOG_PRODUCT_OPEN_REQUESTED_EVENT,
  CATALOG_PROMOTION_APPLIED_EVENT,
  CATALOG_TOPIC,
  createCartAddRequest,
  createCartUpdateRequest,
  createPlpFiltersSnapshot,
  isValidCartAddRequest,
  isValidCartRemoveRequest,
  isValidCartUpdateRequest,
  isValidPlpFiltersPayload,
  isValidProductOpenRequest,
  isValidPromotionAppliedRequest,
} from "./catalogEventContracts.js";

/**
 * Creates a catalog-scoped local event adapter for product remotes and host shells.
 *
 * @param {{ mesh: { publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void } }} adapterInput - Configured mesh client for the owning shell.
 * @returns {object} Catalog event adapter with publish helpers and optional intent listeners.
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
   * Publishes a request to apply PLP filters owned by the host shell.
   *
   * @param {unknown} filters - Candidate filter object from the product list page.
   * @returns {void}
   * @sideEffects Publishes a local catalog.filters-apply-requested message.
   */
  function publishFiltersApplyRequested(filters) {
    if (!isValidPlpFiltersPayload(filters)) {
      return;
    }

    publishLocalEvent(
      CATALOG_TOPIC,
      CATALOG_FILTERS_APPLY_REQUESTED_EVENT,
      createPlpFiltersSnapshot(filters),
    );
  }

  /**
   * Publishes a promotion click so the host can apply banner filters.
   *
   * @param {{ filters?: unknown }} promotion - Banner promotion payload.
   * @returns {void}
   * @sideEffects Publishes a local catalog.promotion-applied message.
   */
  function publishPromotionApplied(promotion) {
    if (!isValidPromotionAppliedRequest(promotion)) {
      return;
    }

    publishLocalEvent(CATALOG_TOPIC, CATALOG_PROMOTION_APPLIED_EVENT, {
      filters: createPlpFiltersSnapshot(promotion.filters),
    });
  }

  /**
   * Publishes a request to update a cart line quantity.
   *
   * @param {{ productId: string, quantity: number }} cartItem - Product and new quantity.
   * @returns {void}
   * @sideEffects Publishes a local cart.item-update-requested message when valid.
   */
  function publishCartItemUpdateRequested(cartItem) {
    const normalizedRequest = createCartUpdateRequest(cartItem);
    if (!normalizedRequest) {
      return;
    }

    publishLocalEvent(
      CART_TOPIC,
      CART_ITEM_UPDATE_REQUESTED_EVENT,
      normalizedRequest,
    );
  }

  /**
   * Publishes a request to remove a cart line.
   *
   * @param {string} productId - Catalog product identifier to remove.
   * @returns {void}
   * @sideEffects Publishes a local cart.item-remove-requested message.
   */
  function publishCartItemRemoveRequested(productId) {
    if (typeof productId !== "string" || productId.trim() === "") {
      return;
    }

    publishLocalEvent(CART_TOPIC, CART_ITEM_REMOVE_REQUESTED_EVENT, {
      productId,
    });
  }

  /**
   * Registers persistent catalog intent handlers after a mesh configuration change.
   * Optional handlers are skipped so shells only subscribe to intents they own.
   *
   * @param {{
   *   onProductOpenRequested?: (payload: { productId: string }) => void,
   *   onCartItemAddRequested?: (cartItem: { productId: string, quantity: number }) => void,
   *   onFiltersApplyRequested?: (filters: object) => void,
   *   onPromotionApplied?: (payload: { filters: object }) => void,
   *   onCartItemUpdateRequested?: (cartItem: { productId: string, quantity: number }) => void,
   *   onCartItemRemoveRequested?: (payload: { productId: string }) => void,
   * }} handlers - Host orchestration handlers.
   * @returns {void}
   * @sideEffects Registers local mesh subscriptions for provided handlers.
   */
  function ensureCatalogIntentListeners(handlers) {
    if (catalogIntentListenersStarted) {
      return;
    }

    catalogIntentListenersStarted = true;

    if (typeof handlers.onProductOpenRequested === "function") {
      mesh.subscribe(
        CATALOG_TOPIC,
        CATALOG_PRODUCT_OPEN_REQUESTED_EVENT,
        (message) => {
          if (isValidProductOpenRequest(message.payload)) {
            handlers.onProductOpenRequested(message.payload);
          }
        },
      );
    }

    if (typeof handlers.onCartItemAddRequested === "function") {
      mesh.subscribe(CART_TOPIC, CART_ITEM_ADD_REQUESTED_EVENT, (message) => {
        if (isValidCartAddRequest(message.payload)) {
          handlers.onCartItemAddRequested(message.payload);
        }
      });
    }

    if (typeof handlers.onFiltersApplyRequested === "function") {
      mesh.subscribe(
        CATALOG_TOPIC,
        CATALOG_FILTERS_APPLY_REQUESTED_EVENT,
        (message) => {
          if (isValidPlpFiltersPayload(message.payload)) {
            handlers.onFiltersApplyRequested(
              createPlpFiltersSnapshot(message.payload),
            );
          }
        },
      );
    }

    if (typeof handlers.onPromotionApplied === "function") {
      mesh.subscribe(
        CATALOG_TOPIC,
        CATALOG_PROMOTION_APPLIED_EVENT,
        (message) => {
          if (isValidPromotionAppliedRequest(message.payload)) {
            handlers.onPromotionApplied({
              filters: createPlpFiltersSnapshot(message.payload?.filters),
            });
          }
        },
      );
    }

    if (typeof handlers.onCartItemUpdateRequested === "function") {
      mesh.subscribe(
        CART_TOPIC,
        CART_ITEM_UPDATE_REQUESTED_EVENT,
        (message) => {
          if (isValidCartUpdateRequest(message.payload)) {
            handlers.onCartItemUpdateRequested(message.payload);
          }
        },
      );
    }

    if (typeof handlers.onCartItemRemoveRequested === "function") {
      mesh.subscribe(
        CART_TOPIC,
        CART_ITEM_REMOVE_REQUESTED_EVENT,
        (message) => {
          if (isValidCartRemoveRequest(message.payload)) {
            handlers.onCartItemRemoveRequested(message.payload);
          }
        },
      );
    }
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
    publishFiltersApplyRequested,
    publishPromotionApplied,
    publishCartItemUpdateRequested,
    publishCartItemRemoveRequested,
    ensureCatalogIntentListeners,
    resetCatalogIntentListeners,
  };
}

export { createCatalogEvents };
