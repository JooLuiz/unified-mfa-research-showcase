/**
 * Exposes shared catalog Event Mesh event adapters.
 * Role: Public barrel for product-open and cart-add event contracts.
 * Not in this file: Event behavior, mesh configuration, or shell orchestration.
 * Key dependencies: None.
 * See also: src/createCatalogEvents.js; src/catalogEventContracts.js.
 */

export { createCatalogEvents } from "./createCatalogEvents.js";
export {
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_PRODUCT_OPEN_REQUESTED_EVENT,
  CATALOG_TOPIC,
  createCartAddRequest,
  isValidCartAddRequest,
  isValidProductOpenRequest,
} from "./catalogEventContracts.js";
