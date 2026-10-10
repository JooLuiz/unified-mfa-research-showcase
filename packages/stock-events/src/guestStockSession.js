/**
 * Owns the guest's per-tab stock identity.
 * Role: Reads or creates the sessionStorage-backed guest stock session id shared by the shared
 *   watch stream and the shell's own reservation calls, so both always agree on one identity.
 * Not in this file: Mesh transport or the stock watch client's subscription lifecycle.
 * Key dependencies: window.sessionStorage.
 * See also: src/createStockWatchClient.js; src/stockReservationCommands.js.
 */

const GUEST_STOCK_SESSION_STORAGE_KEY = "ecommerce-shell:stock-session";

function generateGuestStockSessionId() {
  return `guest-stock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reads this tab's guest stock session id, creating and storing one on first use.
 *
 * @returns {string} Stable guest session id for the lifetime of this tab.
 * @sideEffects Writes sessionStorage on first call in a given tab.
 */
function getOrCreateGuestStockSessionId() {
  const existingSessionId = window.sessionStorage.getItem(GUEST_STOCK_SESSION_STORAGE_KEY);
  if (existingSessionId) {
    return existingSessionId;
  }
  const nextSessionId = generateGuestStockSessionId();
  window.sessionStorage.setItem(GUEST_STOCK_SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
}

export { GUEST_STOCK_SESSION_STORAGE_KEY, getOrCreateGuestStockSessionId };
