/**
 * Names catalog and cart contracts shared by product remotes and the ecommerce shell.
 * Role: Holds topic, event, and cart-add payload checks.
 * Not in this file: Window CustomEvent names or cart mutation.
 * Key dependencies: None.
 * See also: src/createCatalogEvents.js.
 */

const CART_TOPIC = "cart";
const CART_ITEM_ADD_REQUESTED_EVENT = "item-add-requested";
const CART_CHANGED_EVENT = "changed";
const CATALOG_TOPIC = "catalog";
const PRODUCT_OPEN_REQUESTED_EVENT = "product-open-requested";

/**
 * Checks whether a value is a cart add request the shell can apply.
 *
 * @param {unknown} value - Candidate add-to-cart payload.
 * @returns {value is { productId: string, quantity?: number }} Whether productId is present and quantity, when set, is finite.
 */
function isValidCartAddRequest(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = /** @type {{ productId?: unknown, quantity?: unknown }} */ (value);
  if (typeof candidate.productId !== "string" || candidate.productId.trim() === "") {
    return false;
  }
  if (candidate.quantity === undefined) {
    return true;
  }
  return typeof candidate.quantity === "number" && Number.isFinite(candidate.quantity);
}

export {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
  PRODUCT_OPEN_REQUESTED_EVENT,
  isValidCartAddRequest,
};
