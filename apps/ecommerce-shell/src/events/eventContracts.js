/**
 * Re-exports shared shell and catalog contracts for the ecommerce shell.
 * Role: Keeps the phase 2 import path while the package contracts own the names.
 * Not in this file: Browser event mapping (src/events/browserTransport.js).
 * Key dependencies: @shared/shell-events; @shared/catalog-events.
 * See also: src/events/eventBus.js.
 */

export {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  RENDER_REQUESTED_EVENT,
  SHELL_TOPIC,
} from "@shared/shell-events";

export {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
  PRODUCT_OPEN_REQUESTED_EVENT,
} from "@shared/catalog-events";
