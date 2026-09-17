/**
 * Publishes and subscribes to social shell-local Event Mesh messages.
 * Role: Hides shared auth/navigation mesh transport details behind social shell operations.
 * Not in this file: Mesh configuration, authentication state, routing, or UI rendering.
 * Key dependencies: event-mesh/mesh; @shared/shell-events.
 * See also: src/main.js; src/utils/mountActions.js.
 */

import mesh from "event-mesh/mesh";
import { createShellEvents } from "@shared/shell-events";

const shellEvents = createShellEvents({ mesh });

export const {
  ensureShellEventListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishRenderRequested,
  resetShellEventListeners,
  subscribeToAuthSessionChanges,
} = shellEvents;
