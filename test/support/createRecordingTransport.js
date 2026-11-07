/**
 * Records publish and subscribe calls for shared package contract tests.
 * Role: In-memory stand-in for a branch transport, so package tests assert topic, event, payload, and scope without importing a browser or Event Mesh adapter.
 * Not in this file: Window events, postMessage, HTTP, or the Event Mesh client.
 * Key dependencies: None.
 * See also: test-plans/phase-3-package-contracts.md.
 */

/**
 * Creates a transport that stores every published message and delivers it to matching subscribers.
 *
 * @returns {{ published: Array<{ topic: string, event: string, payload?: object, scope?: string }>, publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void }} Recording transport.
 * @sideEffects publish appends to published and invokes current subscribers for that topic and event.
 */
export function createRecordingTransport() {
  const published = [];
  const subscribers = new Map();

  return {
    published,
    publish(message) {
      published.push(message);
      const key = `${message.topic}:${message.event}`;
      (subscribers.get(key) || []).forEach((subscriber) => subscriber(message));
    },
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
  };
}
