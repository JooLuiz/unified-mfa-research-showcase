/**
 * HTTP adapter that satisfies the shared event interface.
 * Role: Routes publish, subscribe, and request through the endpoint maps and the shared connection registry.
 * Not in this file: Window CustomEvent routing (src/composeShellTransport.js).
 * Key dependencies: src/eventEndpoints.js; src/openEventConnection.js.
 * See also: apps/ecommerce-shell/src/events/eventBus.js.
 */

import { createSharedEndpoints } from "./eventEndpoints.js";
import { subscribeToEventConnection } from "./openEventConnection.js";

/**
 * @param {{ getApiBaseUrl: () => string, getAuthToken?: () => string, getStockSessionId?: () => string, endpoints?: { requests?: object, publishes?: object, connections?: object } }} serverInput
 * @returns {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }}
 */
function createServerEvents({
  getApiBaseUrl,
  getAuthToken = () => "",
  getStockSessionId = () => "",
  endpoints = {},
}) {
  const inboxShell = { current: "" };
  const sharedEndpoints = createSharedEndpoints({ getStockSessionId, inboxShell });
  const requests = { ...sharedEndpoints.requests, ...(endpoints.requests || {}) };
  const publishes = { ...sharedEndpoints.publishes, ...(endpoints.publishes || {}) };
  const connections = { ...sharedEndpoints.connections, ...(endpoints.connections || {}) };
  const connectionByContract = indexConnections(connections);

  /**
   * Fire-and-forget command. Unknown events are ignored.
   *
   * @param {{ topic: string, event: string, payload?: object, scope?: string }} message
   * @returns {void}
   * @sideEffects Sends the mapped HTTP request and swallows rejection.
   */
  function publish(message) {
    const descriptor = publishes[`${message.topic}:${message.event}`];
    if (!descriptor) {
      return;
    }
    const payload = message.payload || {};
    const apiBaseUrl = getApiBaseUrl();
    fetch(`${apiBaseUrl}${descriptor.path(payload)}`, {
      method: descriptor.method,
      headers: descriptor.headers(payload),
      body: JSON.stringify(descriptor.body(payload)),
    }).catch((error) => {
      console.warn("createServerEvents publish - error");
      console.warn(error);
    });
  }

  /**
   * Subscribes to one server frame. One physical connection is shared by every frame on that connection.
   *
   * @param {string} topic
   * @param {string} event
   * @param {(message: { payload?: object }) => void} callback
   * @returns {() => void}
   * @sideEffects Opens or joins the connection for this topic.
   */
  function subscribe(topic, event, callback) {
    const connection = connectionByContract.get(`${topic}:${event}`);
    if (!connection) {
      return function unsubscribeFromUnknownContract() {};
    }
    return subscribeToEventConnection({
      apiBaseUrl: getApiBaseUrl(),
      connection,
      topic,
      event,
      callback,
      getAuthToken,
      getStockSessionId,
    });
  }

  /**
   * Request/response command.
   *
   * @param {{ topic: string, event: string, payload?: object }} message
   * @returns {Promise<{ ok: boolean, code?: string, status?: number }>}
   * @sideEffects Performs the mapped HTTP request.
   */
  async function request(message) {
    const descriptor = requests[`${message.topic}:${message.event}`];
    if (!descriptor) {
      return { ok: false, code: "unknown-request" };
    }
    const payload = message.payload || {};
    if (descriptor.remember) {
      descriptor.remember(payload);
    }
    const authToken = payload.authToken || getAuthToken() || "";
    if (descriptor.rejectWithoutAuth && !authToken) {
      return descriptor.missingAuthResult;
    }
    try {
      const requestInit = {
        method: descriptor.method,
        headers: descriptor.headers(authToken, payload),
      };
      if (descriptor.body) {
        requestInit.body = JSON.stringify(descriptor.body(payload));
      }
      const response = await fetch(`${getApiBaseUrl()}${descriptor.path(payload)}`, requestInit);
      if (descriptor.fulfill) {
        return descriptor.fulfill(response, payload);
      }
      return descriptor.parse(response);
    } catch (error) {
      console.warn("createServerEvents request - error");
      console.warn(error);
      if (descriptor.networkResult) {
        return descriptor.networkResult();
      }
      return { ok: false, code: "network-error" };
    }
  }

  /**
   * HTTP has no socket handshake to wait for.
   *
   * @returns {Promise<void>}
   */
  async function whenConnected() {}

  return { publish, subscribe, request, whenConnected };
}

/**
 * @param {object} connections
 * @returns {Map<string, object>}
 */
function indexConnections(connections) {
  const connectionByContract = new Map();
  Object.values(connections).forEach((connection) => {
    connection.frames.forEach((frame) => {
      connectionByContract.set(`${frame.topic}:${frame.event}`, connection);
    });
  });
  return connectionByContract;
}

export { createServerEvents };
