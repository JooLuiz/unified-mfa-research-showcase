/**
 * Defines local Event Mesh contracts for ecommerce shell coordination.
 * Role: Centralizes cart-changed and PLP filter contracts; reuses shared cart-add/product-open names from @shared/catalog-events.
 * Not in this file: Mesh publishing, subscriptions, cart mutations, or UI rendering.
 * Key dependencies: @shared/catalog-events.
 * See also: src/events/localMeshEventBus.js; src/main.js; src/utils/PLPFilterActions.js.
 */

import {
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
  isValidCartAddRequest,
} from "@shared/catalog-events";

const CART_CHANGED_EVENT = "changed";
const CATALOG_FILTERS_CHANGED_EVENT = "filters-changed";

/**
 * @typedef {{ productId: string, quantity: number }} CartItem
 * @typedef {{ searchQuery: string, minPrice: string, maxPrice: string, categoryIds: string[] }} PlpFilters
 */

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

/**
 * Checks whether a value is a valid cart item.
 *
 * @param {unknown} value - Candidate cart item.
 * @returns {value is CartItem} Whether the value has a product ID and positive quantity.
 */
function isValidCartItem(value) {
  return isValidCartAddRequest(value);
}

/**
 * Creates a safe cart snapshot for delivery to mesh subscribers.
 *
 * @param {unknown} cartItems - Candidate cart item collection.
 * @returns {CartItem[]} Cloned valid cart items with integer quantities.
 */
function createCartSnapshot(cartItems) {
  if (!Array.isArray(cartItems)) {
    return [];
  }

  return cartItems
    .filter(isValidCartItem)
    .map((cartItem) => ({
      productId: cartItem.productId,
      quantity: Math.floor(cartItem.quantity),
    }));
}

/**
 * Creates a safe PLP filter snapshot for mesh delivery.
 *
 * @param {unknown} filters - Candidate filter object.
 * @returns {PlpFilters} Normalized filter snapshot with string fields and string category ids.
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

export {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_FILTERS_CHANGED_EVENT,
  CATALOG_TOPIC,
  createCartSnapshot,
  createPlpFiltersSnapshot,
  isValidCartAddRequest,
};
