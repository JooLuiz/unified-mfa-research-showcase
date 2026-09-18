/**
 * Publishes and subscribes to social shell-local Event Mesh messages.
 * Role: Hides shared auth/navigation, catalog, account, and community mesh transport behind social shell operations.
 * Not in this file: Mesh configuration, authentication state, routing, or UI rendering.
 * Key dependencies: event-mesh/mesh; @shared/shell-events; @shared/catalog-events; @shared/account-events; @shared/community-events.
 * See also: src/main.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import mesh from "event-mesh/mesh";
import { createShellEvents } from "@shared/shell-events";
import { createCatalogEvents } from "@shared/catalog-events";
import { createAccountEvents } from "@shared/account-events";
import { createCommunityEvents } from "@shared/community-events";

const shellEvents = createShellEvents({ mesh });
const catalogEvents = createCatalogEvents({ mesh });
const accountEvents = createAccountEvents({ mesh });
const communityEvents = createCommunityEvents({ mesh });

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

export const {
  ensureAccountIntentListeners,
  resetAccountIntentListeners,
} = accountEvents;

export const {
  ensureCommunityIntentListeners,
  resetCommunityIntentListeners,
} = communityEvents;
