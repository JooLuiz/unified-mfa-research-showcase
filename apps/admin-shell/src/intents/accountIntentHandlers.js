/**
 * Handles the signed-in user's profile and address save requests from the account remotes.
 * Role: One place for the account update each save request sends. The shell registers these as
 *   account intent listeners.
 * Not in this file: How a request reaches the shell, or the update HTTP call and its toasts
 *   (src/commands/accountCommands.js).
 * Key dependencies: src/commands/accountCommands.js; src/events/eventBus.js.
 * See also: src/pages/accountPage.js.
 */

import { persistAccountUpdate } from "../commands/accountCommands";
import { shellTransport } from "../events/eventBus";

/**
 * Creates the account request handlers for one shell state.
 *
 * @param {object} appState - Shell state holding the authenticated session.
 * @param {{
 *   getTransport?: () => object,
 *   persist?: (transport: object, appState: object, update: object) => Promise<{ ok: boolean }>,
 * }} [dependencies] - Collaborators. They default to the shell's own. getTransport is read on
 *   every save, so a transport installed after startup is used.
 * @returns {{
 *   onProfileSaveRequested: (profile: { fullName: string, gender: string }) => Promise<{ ok: boolean }>,
 *   onAddressSaveRequested: (address: object) => Promise<{ ok: boolean }>,
 * }} Handlers. Each resolves to the save outcome.
 */
function createAccountIntentHandlers(
  appState,
  { getTransport = () => shellTransport, persist = persistAccountUpdate } = {},
) {
  return {
    onProfileSaveRequested(profile) {
      return persist(getTransport(), appState, profile);
    },
    onAddressSaveRequested(address) {
      return persist(getTransport(), appState, { address });
    },
  };
}

export { createAccountIntentHandlers };
