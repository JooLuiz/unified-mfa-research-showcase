/**
 * Public notification APIs and opt-in event-mesh integration seam.
 * Role: Exposes UI notification primitives and the linked mesh client without invoking it.
 * Not in this file: Toast behavior, mesh configuration, event subscriptions, or publishing.
 * Key dependencies: event-mesh/mesh resolved through the local Yarn link.
 * See also: src/createNotificationBus.js; src/mountNotificationCenter.js.
 */

export { createNotificationBus } from "./createNotificationBus.js";
export { mountNotificationCenter } from "./mountNotificationCenter.js";
export { default as mesh, configureMesh } from "event-mesh/mesh";
