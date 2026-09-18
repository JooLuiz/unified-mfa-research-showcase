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

export const {
  ensureShellEventListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishRenderRequested,
  resetShellEventListeners,
} = shellEvents;

export const {
  ensureAccountIntentListeners,
  resetAccountIntentListeners,
} = accountEvents;
