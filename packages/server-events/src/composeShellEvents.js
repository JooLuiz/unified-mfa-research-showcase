/**
 * Joins the shell's local bus and the server adapter into one event interface.
 * Role: Returns the server adapter's four methods. On this branch the injected client already
 *   delivers scope "local" messages inside the page, so there is no separate window bus to route to.
 * Not in this file: Gateway aliases or command descriptors.
 * Key dependencies: None.
 * See also: src/createServerEvents.js; apps/ecommerce-shell/src/events/eventBus.js.
 *   On main this splits calls between a window CustomEvent bus and the HTTP adapter.
 */

/**
 * @param {{ serverEvents: { publish: Function, subscribe: Function, request: Function, whenConnected: Function } }} compositionInput
 * @returns {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }}
 */
function composeShellEvents({ serverEvents }) {
  return {
    publish: serverEvents.publish,
    subscribe: serverEvents.subscribe,
    request: serverEvents.request,
    whenConnected: serverEvents.whenConnected,
  };
}

export { composeShellEvents };
