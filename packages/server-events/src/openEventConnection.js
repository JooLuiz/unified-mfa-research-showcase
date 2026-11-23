/**
 * Subscribes to gateway frames and runs request/reply commands over the injected client.
 * Role: Resolves contract aliases to gateway topics, and publishes a command then waits for its
 *   accept or reject reply.
 * Not in this file: Which command maps to which topic (src/eventEndpoints.js) or HTTP reads.
 * Key dependencies: The client passed to createServerEvents (publish, subscribe, whenConnected).
 * See also: src/createServerEvents.js.
 *   On main this file owns the EventSource connection registry; this branch's client keeps one
 *   connection, so only alias resolution and reply waiting live here.
 */

const COMMAND_TIMEOUT_MS = 15000;
const CONNECT_TIMEOUT_MS = 5000;

/**
 * Subscribes to one contract, through its gateway alias when one is declared.
 *
 * @param {{ client: { subscribe: Function }, frame?: { gatewayTopic: string, gatewayEvent: string }, topic: string, event: string, callback: (message: { payload?: object }) => void }} subscriptionInput
 * @returns {() => void} Removes the subscription.
 * @sideEffects Registers a client subscription.
 */
function subscribeToEventConnection({ client, frame, topic, event, callback }) {
  if (frame) {
    return client.subscribe(frame.gatewayTopic, frame.gatewayEvent, callback);
  }
  return client.subscribe(topic, event, callback);
}

/**
 * Publishes one command and resolves with its reply outcome.
 *
 * @param {{ client: { publish: Function, subscribe: Function, whenConnected: Function }, command: object, payload: object }} requestInput
 * @returns {Promise<object>} Parsed outcome, the reject outcome, or the timeout outcome.
 * @throws {Error} When the client does not connect in time.
 * @sideEffects Publishes the optional beforePublish message and the command.
 */
async function requestReply({ client, command, payload }) {
  await client.whenConnected({ timeoutMs: CONNECT_TIMEOUT_MS });
  const requestId = `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const outcomePromise = waitForCommandReply(client, command, requestId);
  if (command.beforePublish) {
    client.publish(command.beforePublish);
  }
  client.publish({
    topic: command.publishTopic,
    event: command.publishEvent,
    payload: command.toGatewayPayload(payload, requestId),
    scope: "distributed",
  });
  return outcomePromise;
}

/**
 * @param {{ subscribe: Function }} client
 * @param {object} command
 * @param {string} requestId
 * @returns {Promise<object>}
 */
function waitForCommandReply(client, command, requestId) {
  return new Promise((resolve) => {
    let settled = false;
    const unsubscribeFns = [];

    function finish(outcome) {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
      resolve(outcome);
    }

    const timeoutId = window.setTimeout(() => {
      finish(command.timeoutResult || { ok: false, code: "timeout" });
    }, COMMAND_TIMEOUT_MS);

    function handleReply(message, accepted) {
      const replyPayload = message.payload || {};
      if (command.matchRequestId !== false && replyPayload.requestId !== requestId) {
        return;
      }
      finish(
        accepted
          ? command.toOutcome(replyPayload)
          : { ok: false, code: replyPayload.code || "request-failed" },
      );
    }

    unsubscribeFns.push(
      client.subscribe(command.publishTopic, command.acceptEvent, (message) => handleReply(message, true)),
    );
    if (command.rejectEvent) {
      unsubscribeFns.push(
        client.subscribe(command.publishTopic, command.rejectEvent, (message) => handleReply(message, false)),
      );
    }
  });
}

export { requestReply, subscribeToEventConnection };
