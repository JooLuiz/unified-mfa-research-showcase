/**
 * Installs a small document so shell pages can render during a unit test.
 * Role: Parses the markup pages assign to innerHTML and answers querySelector, click, and dataset.
 * Not in this file: Assertions or a particular page.
 * Key dependencies: None.
 * See also: apps/ecommerce-shell/src/utils/mountActions.test.js.
 */

import test from "node:test";
import { register } from "node:module";
import { createElement, createTextNode } from "./pageElement.js";

let federatedRegistration;

/**
 * Registers the remote stub once so account pages can import their remotes under Node.
 *
 * @returns {Promise<void>}
 */
async function registerFederatedRemotes() {
  if (!federatedRegistration) {
    federatedRegistration = register(
      new URL("../../scripts/test/federatedRemoteResolver.mjs", import.meta.url),
      import.meta.url,
    );
  }
  if (federatedRegistration && typeof federatedRegistration.then === "function") {
    await federatedRegistration;
  }
}

/**
 * Reads a CSS-escaped attribute value back into the text stored on the element.
 *
 * @param {string} value - Quoted value from a selector.
 * @returns {string} Unescaped value.
 */
/**
 * Installs document, EventSource, and WebSocket stand-ins, then returns a page root factory.
 *
 * @returns {Promise<{ createPageRoot: () => object }>}
 * @sideEffects Assigns global document, fetch, EventSource, WebSocket, and CSS.escape.
 */
async function installPageDocument() {
  await registerFederatedRemotes();
  window.location.assign = (nextUrl) => {
    window.location.href = nextUrl;
  };
  const documentNode = createDocumentNode();
  globalThis.document = documentNode;
  globalThis.window.document = documentNode;
  globalThis.CSS = {
    escape(value) {
      return String(value).replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
    },
  };
  globalThis.EventSource = class EventSource {
    constructor(url) {
      this.url = url;
    }

    addEventListener() {}

    close() {}
  };
  globalThis.WebSocket = class WebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = WebSocket.CONNECTING;
    }

    addEventListener() {}

    send() {}

    close() {
      this.readyState = WebSocket.CLOSED;
    }

    set onopen(handler) {
      this.readyState = WebSocket.OPEN;
      if (typeof handler === "function") {
        queueMicrotask(() => handler());
      }
    }

    set onmessage(_handler) {}

    set onerror(_handler) {}

    set onclose(_handler) {}
  };
  if (typeof globalThis.URL.createObjectURL !== "function") {
    globalThis.URL.createObjectURL = () => "blob:page-test";
    globalThis.URL.revokeObjectURL = () => {};
  }
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({}),
    blob: async () => new Blob(["ok"]),
  });
  return {
    createPageRoot() {
      return documentNode.createElement("div");
    },
  };
}

/**
 * Points the browser location at a path that is not the next navigation target.
 *
 * @param {string} pathname - Pathname to show before the page navigates.
 * @param {string} [search] - Query string including the leading question mark.
 * @returns {void}
 */
function resetLocation(pathname, search = "") {
  window.location.pathname = pathname;
  window.location.search = search;
  window.location.hash = "";
}

let locationQueue = Promise.resolve();

/**
 * Runs a test after earlier location tests in this file, so they do not share one address bar.
 *
 * @param {string} name - Test name.
 * @param {() => Promise<void> | void} body - Test body.
 * @returns {void}
 */
function queueTest(name, body) {
  test(name, () => {
    const run = locationQueue.then(body, body);
    locationQueue = run.then(
      () => {},
      () => {},
    );
    return run;
  });
}

/**
 * Replaces fetch with a router the page's HTTP calls can hit.
 *
 * @param {(url: string, options: object) => { ok?: boolean, status?: number, body?: object, throwError?: Error } | Promise<{ ok?: boolean, status?: number, body?: object, throwError?: Error }>} routeRequest - Maps a URL to a response.
 * @returns {void}
 * @sideEffects Assigns globalThis.fetch.
 */
function installFetch(routeRequest) {
  globalThis.fetch = async (url, options = {}) => {
    const decision = (await routeRequest(String(url), options)) || {};
    if (decision.throwError) {
      throw decision.throwError;
    }
    const ok = decision.ok !== false;
    const body = decision.body ?? {};
    return {
      ok,
      status: decision.status ?? (ok ? 200 : 500),
      statusText: ok ? "OK" : "Error",
      async json() {
        return body;
      },
      async blob() {
        return new Blob([typeof body === "string" ? body : JSON.stringify(body)]);
      },
    };
  };
}

/**
 * Records each remote mount and returns a handle pages can update or call as cleanup.
 *
 * @returns {{ calls: object[], mountLoginForm: Function, mountOrderDetails: Function, mountCheckoutEmpty: Function, mountCheckoutItems: Function, mountCheckoutSummary: Function, mountApplyCoupon: Function, mountPromotionalBanner: Function, mountProductShowcase: Function, mountProductList: Function, mountProductDetails: Function, mountProductCard: Function, mountFormularySent: Function, mountPostFeed: Function, mountNewPostFormulary: Function }} Remote stand-ins.
 */
function createRemoteRecorder() {
  const calls = [];

  function record(name) {
    return function mountRemote(element, props) {
      const updates = [];
      function remoteHandle() {}
      remoteHandle.element = element;
      remoteHandle.props = props;
      remoteHandle.updates = updates;
      remoteHandle.update = (nextProps) => {
        updates.push(nextProps);
      };
      remoteHandle.unmount = () => {
        remoteHandle.unmounted = true;
      };
      remoteHandle.applyAvailable = (productId, available) => {
        remoteHandle.available = { productId, available };
      };
      calls.push({ name, element, props, handle: remoteHandle });
      return remoteHandle;
    };
  }

  return {
    calls,
    mountApplyCoupon: record("applyCoupon"),
    mountCheckoutEmpty: record("checkoutEmpty"),
    mountCheckoutItems: record("checkoutItems"),
    mountCheckoutSummary: record("checkoutSummary"),
    mountFormularySent: record("formularySent"),
    mountLoginForm: record("login"),
    mountNewPostFormulary: record("newPost"),
    mountOrderDetails: record("orderDetails"),
    mountPostFeed: record("postFeed"),
    mountProductCard: record("productCard"),
    mountProductDetails: record("productDetails"),
    mountProductList: record("productList"),
    mountProductShowcase: record("showcase"),
    mountPromotionalBanner: record("banner"),
  };
}

/**
 * Returns the latest recorded mount for one remote name.
 *
 * @param {{ calls: object[] }} recorder - Recorder from createRemoteRecorder.
 * @param {string} name - Mount name passed to record.
 * @returns {object | undefined} The latest call.
 */
function latestRemoteCall(recorder, name) {
  const matches = recorder.calls.filter((call) => call.name === name);
  return matches[matches.length - 1];
}

/**
 * Calls a handler the page passed to a remote, when that page supplied one.
 *
 * @param {object | undefined} props - Props captured from a mount call.
 * @param {string} handlerName - Callback property name.
 * @param {...unknown} args - Arguments the remote would pass.
 * @returns {Promise<boolean>} True when the handler ran.
 */
async function invokeHandler(props, handlerName, ...args) {
  const handler = props?.[handlerName];
  if (typeof handler !== "function") {
    return false;
  }
  await handler(...args);
  return true;
}

/**
 * Builds the document node pages use for createElement.
 *
 * @returns {object} Document stand-in.
 */
function createDocumentNode() {
  const documentNode = {
    nodeType: 9,
    nodeName: "#document",
    childNodes: [],
    createElement(tagName) {
      return createElement(tagName, documentNode);
    },
    createElementNS(_namespace, tagName) {
      return createElement(tagName, documentNode);
    },
    createTextNode(text) {
      return createTextNode(text, documentNode);
    },
  };
  documentNode.ownerDocument = documentNode;
  documentNode.body = documentNode.createElement("body");
  documentNode.documentElement = documentNode.createElement("html");
  documentNode.documentElement.appendChild(documentNode.body);
  return documentNode;
}

export {
  createRemoteRecorder,
  installFetch,
  installPageDocument,
  invokeHandler,
  latestRemoteCall,
  queueTest,
  resetLocation,
};
