/**
 * Publishes and subscribes to social shell-local Event Mesh messages.
 * Role: Hides shared auth/navigation and catalog-intent mesh transport behind social shell operations.
 * Not in this file: Mesh configuration, authentication state, routing, or UI rendering.
 * Key dependencies: event-mesh/mesh; @shared/shell-events; @shared/catalog-events.
 * See also: src/main.js; src/utils/mountActions.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import mesh from "event-mesh/mesh";
import { createShellEvents } from "@shared/shell-events";
import { createCatalogEvents } from "@shared/catalog-events";

const shellEvents = createShellEvents({ mesh });
const catalogEvents = createCatalogEvents({ mesh });

export const {
  ensureShellEventListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishRenderRequested,
  resetShellEventListeners,
  subscribeToAuthSessionChanges,
} = shellEvents;

export const {
  ensureCatalogIntentListeners,
  resetCatalogIntentListeners,
} = catalogEvents;
