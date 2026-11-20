/**
 * Records publish, subscribe, and request calls for shared package contract tests.
 * Role: In-memory stand-in for a branch transport, so package tests assert topic, event, payload, and scripted request outcomes without importing a browser or Event Mesh adapter.
 * Not in this file: Window events, postMessage, HTTP, or the Event Mesh client.
 * Key dependencies: None.
 * See also: packages/stock-events/src/stockReservationCommands.test.js.
 */

/**
 * Creates a transport that stores every published message and delivers it to matching subscribers.
 *
 * @param {{ requestReply?: object, requestReplies?: object[] }} [script] - Optional request outcomes. requestReplies are consumed in order. requestReply is used when the queue is empty. With neither, request resolves { ok: true }.
 * @returns {{ published: Array<{ topic: string, event: string, payload?: object, scope?: string }>, publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void, request: (message: { topic: string, event: string, payload?: object }) => Promise<object>, deliver: (topic: string, event: string, payload?: object) => void, whenConnected: () => Promise<void> }} Recording transport.
 * @sideEffects publish, deliver, and request append to published. publish and deliver invoke current subscribers for that topic and event.
 */
export function createRecordingTransport({ requestReply, requestReplies } = {}) {
  const published = [];
  const subscribers = new Map();
  const queuedReplies = [...(requestReplies || [])];

  /**
   * @returns {object} The next scripted request outcome.
   */
  function nextRequestResult() {
    if (queuedReplies.length > 0) {
      return queuedReplies.shift();
    }
    if (requestReply !== undefined) {
      return requestReply;
    }
    return { ok: true };
  }

  /**
   * @param {{ topic: string, event: string, payload?: object, scope?: string }} message
   * @returns {void}
   * @sideEffects Appends the message and calls current subscribers.
   */
  function publish(message) {
    published.push(message);
    const key = `${message.topic}:${message.event}`;
    (subscribers.get(key) || []).forEach((subscriber) => subscriber(message));
  }

  return {
    published,
    publish,
    subscribe(topic, event, callback) {
      const key = `${topic}:${event}`;
      if (!subscribers.has(key)) {
        subscribers.set(key, []);
      }
      subscribers.get(key).push(callback);
      return function unsubscribe() {
        subscribers.set(
          key,
          subscribers.get(key).filter((subscriber) => subscriber !== callback),
        );
      };
    },
    request(message) {
      published.push(message);
      return Promise.resolve(nextRequestResult());
    },
    deliver(topic, event, payload) {
      publish({ topic, event, payload });
    },
    whenConnected() {
      return Promise.resolve();
    },
  };
}
