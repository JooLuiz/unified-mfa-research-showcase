/**
 * Carries in-page messages between a shell and the remotes it mounts.
 * Role: The transport remotes hand to the @shared catalog, community, checkout, and account event
 *   packages. On this
 *   branch each message is a window CustomEvent. The mesh branch replaces this body with the
 *   shared Event Mesh client at the same path.
 * Not in this file: Server requests (src/createServerEvents.js) or iframe messages
 *   (src/createFrameMessageEvents.js).
 * Key dependencies: Browser window CustomEvent.
 * See also: src/composeShellEvents.js; apps/ecommerce-shell/src/events/eventBus.js.
 */

const LEGACY_PAGE_EVENT_NAMES = {
  "cart.item-add-requested": "cart:add-item",
  "cart.changed": "cart:updateGlobalCart",
};

const PAGE_TOPICS = new Set(["catalog", "community", "checkout"]);
const PAGE_CART_EVENTS = new Set([
  "item-add-requested",
  "item-update-requested",
  "item-remove-requested",
]);
// Only the account save intents travel in the page. account.update is a server request.
const PAGE_ACCOUNT_EVENTS = new Set(["profile-save-requested", "address-save-requested"]);

/**
 * Names the window event that carries one contract inside the page.
 *
 * @param {string} topic - Contract topic.
 * @param {string} event - Contract event.
 * @returns {string} Window event name. Older cart contracts keep their original names.
 */
function pageEventName(topic, event) {
  return LEGACY_PAGE_EVENT_NAMES[`${topic}.${event}`] || `${topic}:${event}`;
}

/**
 * Tells whether a contract is a remote-to-shell intent carried inside the page.
 *
 * @param {string} topic - Contract topic.
 * @param {string} event - Contract event.
 * @returns {boolean} True for catalog, community, and checkout contracts, cart line requests, and
 *   account save requests.
 */
function isPageContract(topic, event) {
  return (
    PAGE_TOPICS.has(topic) ||
    (topic === "cart" && PAGE_CART_EVENTS.has(event)) ||
    (topic === "account" && PAGE_ACCOUNT_EVENTS.has(event))
  );
}

/**
 * Creates the in-page transport for one shell or remote.
 *
 * @returns {{
 *   publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void,
 *   subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void,
 *   whenConnected: () => Promise<void>,
 * }} Page transport. A distributed-scope message has no page listener here and is dropped.
 * @sideEffects Dispatches and listens for window CustomEvents.
 */
function createPageEvents() {
  return {
    publish({ topic, event, payload, scope }) {
      if (scope === "distributed") {
        return;
      }
      window.dispatchEvent(new CustomEvent(pageEventName(topic, event), { detail: payload }));
    },
    subscribe(topic, event, callback) {
      const eventName = pageEventName(topic, event);
      function handlePageEvent(domEvent) {
        callback({ payload: domEvent.detail });
      }
      window.addEventListener(eventName, handlePageEvent);
      return function unsubscribeFromPageEvent() {
        window.removeEventListener(eventName, handlePageEvent);
      };
    },
    whenConnected() {
      return Promise.resolve();
    },
  };
}

export { createPageEvents, isPageContract, pageEventName };
