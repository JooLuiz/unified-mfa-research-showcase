/**
 * Public barrel for @shared/order-status-events.
 * Role: Re-exports the customer stream, the admin stream, and the status label helper.
 * Not in this file: Implementations (see the sibling modules).
 * Key dependencies: None.
 * See also: src/index.d.ts.
 */

export { formatOrderStatus } from "./orderStatusContracts.js";
export {
  startCustomerOrderStatusStream,
  stopCustomerOrderStatusStream,
  subscribeToOrderStatusChanged,
  requestOrderCancellation,
} from "./customerOrderStatusClient.js";
export {
  startAdminOrderStatusStream,
  stopAdminOrderStatusStream,
  subscribeToAdminOrderStatusChanged,
  requestAdminOrderStatusChange,
} from "./adminOrderStatusClient.js";
