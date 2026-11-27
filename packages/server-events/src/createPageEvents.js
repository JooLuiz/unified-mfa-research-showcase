/**
 * Carries in-page messages between a shell and the remotes it mounts.
 * Role: The transport remotes hand to @shared/catalog-events and @shared/community-events. On this
 *   branch it is the shared Event Mesh client, so a local-scope intent reaches the shell's mesh
 *   listeners and a distributed-scope message reaches the gateway. main has a window CustomEvent
 *   body at this same path, plus the isPageContract and pageEventName helpers its shells use to
 *   name those window events; the mesh shells need neither.
 * Not in this file: Gateway requests (src/createServerEvents.js), mesh configuration (the shell
 *   owns configureMesh), or iframe messages (src/createFrameMessageEvents.js).
 * Key dependencies: event-mesh/mesh singleton.
 * See also: src/composeShellEvents.js; apps/ecommerce-shell/src/events/eventBus.js.
 */

import mesh from "event-mesh/mesh";

/**
 * Creates the in-page transport for one shell or remote.
 *
 * @returns {{
 *   publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void,
 *   subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void,
 *   whenConnected: (options?: { timeoutMs?: number }) => Promise<void>,
 * }} Page transport over the shared mesh client.
 * @sideEffects Publishes and subscribes on the shared Event Mesh client.
 */
function createPageEvents() {
  return {
    publish(message) {
      mesh.publish(message);
    },
    subscribe(topic, event, callback) {
      return mesh.subscribe(topic, event, callback);
    },
    whenConnected(options) {
      return mesh.whenConnected(options);
    },
  };
}

export { createPageEvents };
