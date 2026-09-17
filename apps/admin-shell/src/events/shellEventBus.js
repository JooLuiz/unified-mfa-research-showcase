/**
 * Publishes and subscribes to admin shell-local Event Mesh messages.
 * Role: Hides shared auth/navigation mesh transport details behind admin shell operations.
 * Not in this file: Mesh configuration, authentication state, routing, or UI rendering.
 * Key dependencies: event-mesh/mesh; @shared/shell-events.
 * See also: src/main.js; src/utils/authActions.js.
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
} = shellEvents;
