/**
 * Publishes and subscribes to admin shell-local Event Mesh messages.
 * Role: Hides shared auth/navigation and account-intent mesh transport behind admin shell operations.
 * Not in this file: Mesh configuration, authentication state, routing, or UI rendering.
 * Key dependencies: event-mesh/mesh; @shared/shell-events; @shared/account-events.
 * See also: src/main.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import mesh from "event-mesh/mesh";
import { createShellEvents } from "@shared/shell-events";
import { createAccountEvents } from "@shared/account-events";

const shellEvents = createShellEvents({ mesh });
const accountEvents = createAccountEvents({ mesh });

/**
 * Parity no-op for header subscription on mesh branch.
 *
 * @param {unknown} _headerElement - Custom element target.
 * @param {unknown} _handlers - Header action handlers.
 * @returns {() => void} Unsubscribe no-op.
 */
function subscribeToHeaderEvents(_headerElement, _handlers) {
  return function unsubscribeFromHeaderEvents() {};
}

export const {
  ensureShellEventListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishRenderRequested,
  resetShellEventListeners,
  subscribeToAuthSessionChanges,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} = shellEvents;

export const {
  ensureAccountIntentListeners,
  resetAccountIntentListeners,
} = accountEvents;

export { subscribeToHeaderEvents };
