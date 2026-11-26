/**
 * Names the Event Mesh contracts for ecommerce shell coordination.
 * Role: Holds the cart-changed and PLP filters-changed event names; reuses the shared cart and catalog names from @shared/catalog-events.
 * Not in this file: Mesh publishing, subscriptions, payload snapshots (@shared/catalog-events), cart mutations, or UI rendering.
 * Key dependencies: @shared/catalog-events.
 * See also: src/events/eventBus.js; src/main.js; src/utils/PLPFilterActions.js.
 */

import {
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
} from "@shared/catalog-events";

const CART_CHANGED_EVENT = "changed";
const CATALOG_FILTERS_CHANGED_EVENT = "filters-changed";

export {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_FILTERS_CHANGED_EVENT,
  CATALOG_TOPIC,
};
