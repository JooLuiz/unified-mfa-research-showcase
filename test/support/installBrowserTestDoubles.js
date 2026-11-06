/**
 * Stands in for the browser globals the SSE stream factories touch.
 * Role: Lets package contract tests construct those factories in Node and emit named events.
 * Not in this file: A real network, window events, or the Event Mesh client.
 * Key dependencies: None.
 * See also: test/support/createRecordingTransport.js.
 */

/**
 * Records listeners and replays one named event.
 */
export class FakeEventSource {
  static instances = [];

  /**
   * @param {string} url - Stream URL the factory opened.
   */
  constructor(url) {
    this.url = String(url);
    this.listeners = new Map();
    this.closed = false;
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }

  /**
   * @param {string} eventName - SSE event name.
   * @param {(messageEvent: { data: string }) => void} handler - Factory listener.
   * @returns {void}
   */
  addEventListener(eventName, handler) {
    this.listeners.set(eventName, handler);
  }

  /**
   * @returns {void}
   * @sideEffects Marks the source closed.
   */
  close() {
    this.closed = true;
  }

  /**
   * @param {string} eventName - SSE event name to deliver.
   * @param {object} payload - JSON body the factory will parse.
   * @returns {void}
   * @sideEffects Invokes the registered listener.
   */
  emit(eventName, payload) {
    const handler = this.listeners.get(eventName);
    if (handler) {
      handler({ data: JSON.stringify(payload) });
    }
  }

  /**
   * @param {string} urlPart - Substring of the stream URL.
   * @returns {FakeEventSource | undefined} The most recent source opened for that URL.
   */
  static latestMatching(urlPart) {
    return [...FakeEventSource.instances].reverse().find((source) => source.url.includes(urlPart));
  }
}

/**
 * Installs EventSource, sessionStorage, and window timers for one test process.
 *
 * @returns {void}
 * @sideEffects Assigns global EventSource, window, and a resolving fetch.
 */
export function installBrowserTestDoubles() {
  const storage = new Map();
  globalThis.EventSource = FakeEventSource;
  globalThis.window = {
    sessionStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    setTimeout(callback, delayMs) {
      return globalThis.setTimeout(callback, delayMs);
    },
    clearTimeout(timerId) {
      globalThis.clearTimeout(timerId);
    },
  };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ticket: "ticket-01" }),
  });
}
