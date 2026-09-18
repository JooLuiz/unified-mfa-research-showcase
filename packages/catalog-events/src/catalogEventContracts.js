/**
 * Defines shared local Event Mesh contracts for catalog and cart intents.
 * Role: Centralizes topic/event names and payload validators used by product/checkout remotes and shells.
 * Not in this file: Mesh publishing, shell routing, cart ownership, or PLP filter persistence.
 * Key dependencies: None.
 * See also: src/createCatalogEvents.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

const CART_TOPIC = "cart";
const CART_ITEM_ADD_REQUESTED_EVENT = "item-add-requested";
const CART_ITEM_UPDATE_REQUESTED_EVENT = "item-update-requested";
const CART_ITEM_REMOVE_REQUESTED_EVENT = "item-remove-requested";
const CATALOG_TOPIC = "catalog";
const CATALOG_PRODUCT_OPEN_REQUESTED_EVENT = "product-open-requested";
const CATALOG_FILTERS_APPLY_REQUESTED_EVENT = "filters-apply-requested";
const CATALOG_PROMOTION_APPLIED_EVENT = "promotion-applied";

/**
 * @typedef {{ productId: string, quantity: number }} CartAddRequest
 * @typedef {{ productId: string, quantity: number }} CartUpdateRequest
 * @typedef {{ productId: string }} CartRemoveRequest
 * @typedef {{ searchQuery: string, minPrice: string, maxPrice: string, categoryIds: string[] }} PlpFilters
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

/**
 * Checks whether a value can request updating a cart line quantity.
 *
 * @param {unknown} value - Candidate update payload.
 * @returns {value is CartUpdateRequest} Whether the payload is a valid cart update.
 */
function isValidCartUpdateRequest(value) {
  return isValidCartAddRequest(value);
}

/**
 * Creates a safe cart-update request payload for mesh delivery.
 *
 * @param {unknown} value - Candidate update request.
 * @returns {CartUpdateRequest | null} Normalized payload, or null when invalid.
 */
function createCartUpdateRequest(value) {
  return createCartAddRequest(value);
}

/**
 * Checks whether a value can request removing a cart line.
 *
 * @param {unknown} value - Candidate remove payload.
 * @returns {value is CartRemoveRequest} Whether the payload has a non-empty product id.
 */
function isValidCartRemoveRequest(value) {
  return isValidProductOpenRequest(value);
}

/**
 * Creates a safe PLP filter snapshot for mesh delivery.
 *
 * @param {unknown} filters - Candidate filter object.
 * @returns {PlpFilters} Normalized filter snapshot.
 */
function createPlpFiltersSnapshot(filters) {
  if (!isRecord(filters)) {
    return {
      searchQuery: "",
      minPrice: "",
      maxPrice: "",
      categoryIds: [],
    };
  }

  const categoryIds = Array.isArray(filters.categoryIds)
    ? filters.categoryIds.filter(
        (categoryId) => typeof categoryId === "string",
      )
    : [];

  return {
    searchQuery: String(filters.searchQuery || ""),
    minPrice: String(filters.minPrice || ""),
    maxPrice: String(filters.maxPrice || ""),
    categoryIds,
  };
}

/**
 * Checks whether a value is a filters-apply or promotion filters payload.
 *
 * @param {unknown} value - Candidate filters object.
 * @returns {boolean} Whether the value is a record (normalized on publish/subscribe).
 */
function isValidPlpFiltersPayload(value) {
  return isRecord(value);
}

/**
 * Checks whether a promotion-applied payload is usable.
 *
 * @param {unknown} value - Candidate promotion payload.
 * @returns {value is { filters: PlpFilters }} Whether the payload has a filters object.
 */
function isValidPromotionAppliedRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.filters) || value.filters === undefined;
}

export {
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
};
