/**
 * Joins a window bus and a server adapter into one event interface.
 * Role: Sends scope-local and known window contracts to the browser bus, and every other call to the server adapter.
 * Not in this file: The window event names or the HTTP endpoint map.
 * Key dependencies: None.
 * See also: src/createServerEvents.js; apps/ecommerce-shell/src/events/eventBus.js.
 */

/**
 * @param {{ browserTransport: { publish: Function, subscribe: Function }, serverEvents: { publish: Function, subscribe: Function, request: Function, whenConnected: Function }, isWindowContract: (topic: string, event: string) => boolean }} compositionInput
 * @returns {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }}
 */
function composeShellEvents({ browserTransport, serverEvents, isWindowContract }) {
  /**
   * @param {{ topic: string, event: string, payload?: object, scope?: string }} message
   * @returns {boolean}
   */
  function isLocalMessage(message) {
    return message.scope === "local" || isWindowContract(message.topic, message.event);
  }

  /**
   * @param {{ topic: string, event: string, payload?: object, scope?: string }} message
   * @returns {void}
   * @sideEffects Publishes on the window bus or the server adapter.
   */
  function publish(message) {
    if (isLocalMessage(message)) {
      browserTransport.publish(message);
      return;
    }
    serverEvents.publish(message);
  }

  /**
   * @param {string} topic
   * @param {string} event
   * @param {(message: { payload?: object }) => void} callback
   * @returns {() => void}
   * @sideEffects Subscribes on the window bus or the server adapter.
   */
  function subscribe(topic, event, callback) {
    if (isWindowContract(topic, event)) {
      return browserTransport.subscribe(topic, event, callback);
    }
    return serverEvents.subscribe(topic, event, callback);
  }

  return {
    publish,
    subscribe,
    request: serverEvents.request,
    whenConnected: serverEvents.whenConnected,
  };
}

export { composeShellEvents };
