/**
 * Defines shared local Event Mesh contracts for catalog product intents and cart-add requests.
 * Role: Centralizes topic/event names and payload validators used by product remotes and shells.
 * Not in this file: Mesh publishing, shell routing, cart ownership, or PLP filter persistence.
 * Key dependencies: None.
 * See also: src/createCatalogEvents.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

const CART_TOPIC = "cart";
const CART_ITEM_ADD_REQUESTED_EVENT = "item-add-requested";
const CATALOG_TOPIC = "catalog";
const CATALOG_PRODUCT_OPEN_REQUESTED_EVENT = "product-open-requested";

/**
 * @typedef {{ productId: string, quantity: number }} CartAddRequest
 */

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

/**
 * Checks whether a value can request opening a product details view.
 *
 * @param {unknown} value - Candidate product-open payload.
 * @returns {value is { productId: string }} Whether the payload has a non-empty product id.
 */
function isValidProductOpenRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.productId === "string" && value.productId.trim() !== "";
}

/**
 * Checks whether a value can request adding an item to the cart.
 *
 * @param {unknown} value - Candidate add-item request payload.
 * @returns {value is CartAddRequest} Whether the payload has a product id and positive quantity.
 */
function isValidCartAddRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.productId === "string" &&
    value.productId.trim() !== "" &&
    Number.isFinite(value.quantity) &&
    value.quantity > 0
  );
}

/**
 * Creates a safe cart-add request payload for mesh delivery.
 *
 * @param {unknown} value - Candidate add-item request.
 * @returns {CartAddRequest | null} Normalized payload, or null when invalid.
 */
function createCartAddRequest(value) {
  if (!isValidCartAddRequest(value)) {
    return null;
  }

  return {
    productId: value.productId,
    quantity: Math.floor(value.quantity),
  };
}

export {
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_PRODUCT_OPEN_REQUESTED_EVENT,
  CATALOG_TOPIC,
  createCartAddRequest,
  isValidCartAddRequest,
  isValidProductOpenRequest,
};
