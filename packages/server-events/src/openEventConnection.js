/**
 * Opens one server push connection per base URL and connection id.
 * Role: Refcounts subscribers, reconnects with backoff, and delivers parsed frames as { payload }.
 * Not in this file: Which URL a topic uses (src/eventEndpoints.js) or command requests.
 * Key dependencies: EventSource; fetch when a connection exchanges a ticket inside buildUrl.
 * See also: src/createServerEvents.js.
 */

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/** @type {Map<string, ReturnType<typeof createConnectionEntry>>} */
const connectionsByKey = new Map();

/**
 * @param {object} connectionInput
 * @param {string} connectionInput.apiBaseUrl
 * @param {{ id: string, requiresAuth?: boolean, vary?: () => string, buildUrl: (input: { apiBaseUrl: string, authToken: string, stockSessionId: string, vary: string }) => Promise<string>, frames: Array<{ sseName: string, topic: string, event: string }> }} connectionInput.connection
 * @param {string} connectionInput.topic
 * @param {string} connectionInput.event
 * @param {(message: { payload: object }) => void} connectionInput.callback
 * @param {() => string} connectionInput.getAuthToken
 * @param {() => string} connectionInput.getStockSessionId
 * @returns {() => void} Removes this subscriber and closes the connection when it was the last one.
 * @sideEffects Opens one EventSource for the first subscriber and parses each matching frame.
 */
function subscribeToEventConnection({
  apiBaseUrl,
  connection,
  topic,
  event,
  callback,
  getAuthToken,
  getStockSessionId,
}) {
  const varyValue = connection.vary ? connection.vary() : "";
  const connectionKey = `${apiBaseUrl}|${connection.id}|${varyValue}`;
  let entry = connectionsByKey.get(connectionKey);
  if (!entry) {
    entry = createConnectionEntry({
      connection,
      apiBaseUrl,
      varyValue,
      getAuthToken,
      getStockSessionId,
    });
    connectionsByKey.set(connectionKey, entry);
  }

  const listenerKey = `${topic}:${event}`;
  const listeners = entry.listeners.get(listenerKey) || new Set();
  listeners.add(callback);
  entry.listeners.set(listenerKey, listeners);
  entry.refCount += 1;
  if (entry.refCount === 1) {
    entry.begin();
  }

  return function unsubscribeFromEventConnection() {
    listeners.delete(callback);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.stop();
      connectionsByKey.delete(connectionKey);
    }
  };
}

/**
 * @param {object} entryInput
 * @returns {{ listeners: Map<string, Set<(message: { payload: object }) => void>>, refCount: number, begin: () => void, stop: () => void }}
 */
function createConnectionEntry({
  connection,
  apiBaseUrl,
  varyValue,
  getAuthToken,
  getStockSessionId,
}) {
  /** @type {Map<string, Set<(message: { payload: object }) => void>>} */
  const listeners = new Map();
  let refCount = 0;
  let generation = 0;
  let eventSource = null;
  let reconnectTimer = null;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;

  function deliver(topic, event, payload) {
    const subscribers = listeners.get(`${topic}:${event}`);
    if (!subscribers) {
      return;
    }
    subscribers.forEach((subscriber) => {
      subscriber({ payload });
    });
  }

  function closeSocket() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect(activeGeneration) {
    if (activeGeneration !== generation) {
      return;
    }
    if (connection.requiresAuth && !getAuthToken()) {
      return;
    }
    clearReconnectTimer();
    reconnectTimer = window.setTimeout(() => {
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
      void openSocket(activeGeneration);
    }, reconnectDelayMs);
  }

  /**
   * @param {number} activeGeneration
   * @returns {Promise<void>}
   * @sideEffects Opens an EventSource or schedules a reconnect when the ticket or URL step fails.
   */
  async function openSocket(activeGeneration) {
    try {
      const streamUrl = await connection.buildUrl({
        apiBaseUrl,
        authToken: getAuthToken() || "",
        stockSessionId: getStockSessionId() || "",
        vary: varyValue,
      });
      if (activeGeneration !== generation) {
        return;
      }
      closeSocket();
      eventSource = new EventSource(streamUrl);
      reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      connection.frames.forEach((frame) => {
        eventSource.addEventListener(frame.sseName, (messageEvent) => {
          let payload = {};
          try {
            payload = JSON.parse(messageEvent.data);
          } catch (error) {
            console.warn("openEventConnection - parse error");
            console.warn(error);
          }
          deliver(frame.topic, frame.event, payload);
        });
      });
      eventSource.onerror = () => {
        closeSocket();
        scheduleReconnect(activeGeneration);
      };
    } catch (error) {
      console.warn("openEventConnection - error");
      console.warn(error);
      scheduleReconnect(activeGeneration);
    }
  }

  function begin() {
    if (connection.requiresAuth && !getAuthToken()) {
      return;
    }
    generation += 1;
    void openSocket(generation);
  }

  function stop() {
    generation += 1;
    clearReconnectTimer();
    reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    closeSocket();
  }

  return { listeners, refCount, begin, stop };
}

export { subscribeToEventConnection };
