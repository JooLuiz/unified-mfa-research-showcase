/**
 * Installs the browser globals shell modules touch while a unit test drives them.
 * Role: Provides window, CustomEvent, in-memory storage, and inert EventSource/WebSocket stand-ins
 *   before those modules publish. The stand-ins never connect, so a module that subscribes on mount
 *   behaves the same on main and on mesh branches. Tests that need live fakes install their own later.
 * Not in this file: Assertions or a particular shell's event names.
 * Key dependencies: None.
 * See also: apps/ecommerce-shell/src/events/eventBus.test.js; apps/ecommerce-shell/src/utils/cartSync.test.js.
 */

const listenersByType = new Map();
const nativeSetTimeout = setTimeout;
const nativeClearTimeout = clearTimeout;

/**
 * Builds a storage object that keeps string values in memory.
 *
 * @returns {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void }} Storage stand-in.
 */
function createMemoryStorage() {
  const records = new Map();
  return {
    getItem(key) {
      return records.has(key) ? records.get(key) : null;
    },
    setItem(key, value) {
      records.set(key, String(value));
    },
    removeItem(key) {
      records.delete(key);
    },
  };
}

const browserWindow = {
  parent: null,
  __APP_SHELL_CART__: [],
  postMessage() {},
  addEventListener(type, listener) {
    const group = listenersByType.get(type) || new Set();
    group.add(listener);
    listenersByType.set(type, group);
  },
  removeEventListener(type, listener) {
    const group = listenersByType.get(type);
    if (group) {
      group.delete(listener);
    }
  },
  dispatchEvent(event) {
    for (const listener of listenersByType.get(event.type) || []) {
      listener(event);
    }
    return true;
  },
  setTimeout(callback, delay) {
    return nativeSetTimeout(callback, delay);
  },
  clearTimeout(timerId) {
    nativeClearTimeout(timerId);
  },
  sessionStorage: createMemoryStorage(),
  location: {},
};

const locationRecord = browserWindow.location;
locationRecord.pathname = "/";
locationRecord.search = "";
locationRecord.hash = "";
locationRecord.host = "localhost";
Object.defineProperty(locationRecord, "href", {
  get() {
    return `http://localhost${locationRecord.pathname}${locationRecord.search}${locationRecord.hash}`;
  },
  set(value) {
    const nextUrl = new URL(value, "http://localhost");
    locationRecord.pathname = nextUrl.pathname;
    locationRecord.search = nextUrl.search;
    locationRecord.hash = nextUrl.hash;
  },
});

browserWindow.parent = browserWindow;
browserWindow.history = {
  pushState(_state, _title, nextPath) {
    browserWindow.location.href = nextPath;
  },
  replaceState(_state, _title, nextPath) {
    browserWindow.location.href = nextPath;
  },
};

globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.detail = init.detail;
  }
};
/** EventSource stand-in that never opens and never emits. */
class InertEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url) {
    this.url = url;
    this.readyState = InertEventSource.CONNECTING;
    this.onmessage = null;
    this.onerror = null;
  }

  addEventListener() {}

  removeEventListener() {}

  close() {
    this.readyState = InertEventSource.CLOSED;
  }
}

/** WebSocket stand-in that stays CONNECTING and never calls its handlers. */
class InertWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = InertWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }

  addEventListener() {}

  removeEventListener() {}

  send() {}

  close() {
    this.readyState = InertWebSocket.CLOSED;
  }
}

globalThis.EventSource = InertEventSource;
globalThis.WebSocket = InertWebSocket;
globalThis.window = browserWindow;
globalThis.localStorage = createMemoryStorage();
globalThis.sessionStorage = browserWindow.sessionStorage;
globalThis.history = browserWindow.history;
