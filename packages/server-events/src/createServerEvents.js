/**
 * Gateway adapter that satisfies the shared event interface.
 * Role: Routes publish, subscribe, and request through the endpoint maps and the injected client.
 * Not in this file: Alias resolution and reply waiting (src/openEventConnection.js).
 * Key dependencies: src/eventEndpoints.js; src/openEventConnection.js; event-mesh/mesh.
 * See also: apps/ecommerce-shell/src/events/eventBus.js.
 *   On main this adapter sends HTTP requests and opens EventSource streams; this branch publishes
 *   gateway commands and keeps HTTP only for the reads the gateway does not serve.
 *   MFEs call this without `client` and get the shared mesh singleton; shells pass it explicitly.
 */

import mesh from "event-mesh/mesh";
import { createSharedEndpoints } from "./eventEndpoints.js";
import { requestReply, subscribeToEventConnection } from "./openEventConnection.js";

/**
 * @param {{ client?: { publish: Function, subscribe: Function, whenConnected: Function }, getApiBaseUrl: () => string, getAuthToken?: () => string, getStockSessionId?: () => string, endpoints?: { requests?: object, connections?: object } }} serverInput
 *   `client` defaults to the event-mesh/mesh singleton. `getStockSessionId` is accepted so callers
 *   match main; it is unused here because the gateway assigns the stock watch streamId.
 * @returns {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }}
 */
function createServerEvents({
  client = mesh,
  getApiBaseUrl,
  getAuthToken = () => "",
  getStockSessionId,
  endpoints = {},
}) {
  const sharedEndpoints = createSharedEndpoints();
  const requests = { ...sharedEndpoints.requests, ...(endpoints.requests || {}) };
  const connections = { ...sharedEndpoints.connections, ...(endpoints.connections || {}) };
  const frameByContract = indexFrames(connections);

  /**
   * @param {{ topic: string, event: string, payload?: object, scope?: string }} message
   * @returns {void}
   * @sideEffects Publishes through the client.
   */
  function publish(message) {
    client.publish(message);
  }

  /**
   * @param {string} topic
   * @param {string} event
   * @param {(message: { payload?: object }) => void} callback
   * @returns {() => void}
   * @sideEffects Registers a client subscription.
   */
  function subscribe(topic, event, callback) {
    return subscribeToEventConnection({
      client,
      frame: frameByContract.get(`${topic}:${event}`),
      topic,
      event,
      callback,
    });
  }

  /**
   * Request/response command.
   *
   * @param {{ topic: string, event: string, payload?: object }} message
   * @returns {Promise<{ ok: boolean, code?: string, status?: number }>}
   * @sideEffects Publishes a gateway command or performs an HTTP read.
   */
  async function request(message) {
    const descriptor = requests[`${message.topic}:${message.event}`];
    if (!descriptor) {
      return { ok: false, code: "request-failed" };
    }
    const payload = message.payload || {};
    try {
      if (descriptor.publishTopic) {
        return await runGatewayCommand(descriptor, payload);
      }
      return await runHttpRead(descriptor, payload);
    } catch (error) {
      console.warn("createServerEvents request - error");
      console.warn(error);
      if (descriptor.networkResult) {
        return descriptor.networkResult();
      }
      return { ok: false, code: "network-error" };
    }
  }

  async function runGatewayCommand(descriptor, payload) {
    const outcome = await requestReply({ client, command: descriptor, payload });
    if (outcome.ok && descriptor.afterAccept) {
      await descriptor.afterAccept(outcome, payload, {
        apiBaseUrl: getApiBaseUrl(),
        authToken: getAuthToken() || "",
      });
    }
    return outcome;
  }

  async function runHttpRead(descriptor, payload) {
    const authToken = payload.authToken || getAuthToken() || "";
    if (descriptor.rejectWithoutAuth && !authToken) {
      return descriptor.missingAuthResult;
    }
    const earlyResult = descriptor.resultWithoutRequest?.(payload);
    if (earlyResult) {
      return earlyResult;
    }
    const requestInit = {
      method: descriptor.method,
      headers: descriptor.headers(authToken, payload),
    };
    if (descriptor.body) {
      requestInit.body = JSON.stringify(descriptor.body(payload));
    }
    const response = await fetch(`${getApiBaseUrl()}${descriptor.path(payload)}`, requestInit);
    return descriptor.parse(response);
  }

  /**
   * @param {{ timeoutMs?: number }} [options]
   * @returns {Promise<void>} Resolves once the client is connected.
   */
  function whenConnected(options) {
    return client.whenConnected(options);
  }

  return { publish, subscribe, request, whenConnected };
}

/**
 * @param {object} connections
 * @returns {Map<string, { gatewayTopic: string, gatewayEvent: string }>}
 */
function indexFrames(connections) {
  const frameByContract = new Map();
  Object.values(connections).forEach((connection) => {
    connection.frames.forEach((frame) => {
      frameByContract.set(`${frame.topic}:${frame.event}`, frame);
    });
  });
  return frameByContract;
}

export { createServerEvents };
