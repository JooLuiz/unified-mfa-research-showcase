/**
 * Verifies the new-post iframe host builds a post url, sizes the iframe, and clears itself on cleanup.
 * Role: Locks the iframe markup and the submit callback both comparison branches give a member.
 * Not in this file: How the iframe page delivers its messages to the host.
 * Key dependencies: node:test; src/new-post-formulary.js; test/support/createRecordingTransport.js.
 * See also: src/new-post-formulary.js; src/faq-formulary.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import "../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

globalThis.__webpack_public_path__ = "http://localhost/";

const { mountNewPostFormulary } = await loadAppModule(
  new URL("./new-post-formulary.js", import.meta.url).href,
);

/**
 * Builds a container that records innerHTML and returns one iframe, or none.
 *
 * @param {{ withIframe?: boolean }} [options] - Whether querySelector finds the iframe.
 * @returns {{ container: object, iframe: { style: object } }} Mount target.
 */
function createPostContainer({ withIframe = true } = {}) {
  const iframe = { style: {} };
  const container = {
    lastHtml: "",
    querySelector() {
      return withIframe ? iframe : null;
    },
  };
  Object.defineProperty(container, "innerHTML", {
    get() {
      return container.lastHtml;
    },
    set(value) {
      container.lastHtml = String(value);
    },
  });
  return { container, iframe };
}

/**
 * Points document.querySelector at the new-post iframe for one test body.
 *
 * @param {object | null} iframe - Element the host page finds, or null.
 * @param {() => void} body - Test steps.
 * @returns {void}
 */
function withHostDocument(iframe, body) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    querySelector(selector) {
      return selector.includes("new-post-formulary") ? iframe : null;
    },
  };
  try {
    body();
  } finally {
    if (previousDocument) {
      globalThis.document = previousDocument;
    } else {
      delete globalThis.document;
    }
  }
}

/**
 * Delivers one iframe bridge message to the host.
 *
 * @param {object} transport - Recording transport.
 * @param {string} event - Bridge event name.
 * @param {unknown} payload - Bridge payload.
 * @returns {void}
 */
function deliverBridgeMessage(transport, event, payload) {
  transport.deliver("iframe-bridge", "message", { event, payload });
}

test("mounts a post iframe prefilled for a member and clears it on cleanup", () => {
  const { container, iframe } = createPostContainer();
  const unmount = mountNewPostFormulary(
    container,
    { userName: "Ada", userEmail: "ada@example.com", authorId: "user-7" },
    createRecordingTransport(),
  );

  assert.match(container.innerHTML, /faq-formulary\.html/);
  assert.match(container.innerHTML, /type=post/);
  assert.match(container.innerHTML, /name=Ada/);
  assert.match(container.innerHTML, /email=ada%40example\.com/);
  assert.match(container.innerHTML, /authorId=user-7/);
  assert.match(container.innerHTML, /data-frame-id="new-post-formulary"/);
  assert.equal(iframe.style.height, "0px");

  unmount();
  assert.equal(container.innerHTML, "");
});

test("a guest post iframe has no prefill and mounts without an iframe element", () => {
  const { container } = createPostContainer({ withIframe: false });
  const unmount = mountNewPostFormulary(container, undefined, createRecordingTransport());

  assert.match(container.innerHTML, /type=post/);
  assert.doesNotMatch(container.innerHTML, /name=|email=|authorId=/);

  unmount();
  assert.equal(container.innerHTML, "");
});

test("only a numeric resize for the post frame sets its height, with an 80px minimum", () => {
  const { container, iframe } = createPostContainer();
  const transport = createRecordingTransport();
  const unmount = mountNewPostFormulary(container, {}, transport);

  withHostDocument(iframe, () => {
    deliverBridgeMessage(transport, "resized", null);
    deliverBridgeMessage(transport, "resized", "tall");
    deliverBridgeMessage(transport, "resized", { frameId: "faq-formulary", height: 200 });
    deliverBridgeMessage(transport, "resized", { frameId: "new-post-formulary", height: "tall" });
    assert.equal(iframe.style.height, "0px");

    deliverBridgeMessage(transport, "resized", { frameId: "new-post-formulary", height: 40 });
    assert.equal(iframe.style.height, "80px");

    deliverBridgeMessage(transport, "resized", { frameId: "new-post-formulary", height: 320 });
    assert.equal(iframe.style.height, "320px");
  });

  unmount();
});

test("a resize before the iframe is on the page changes nothing", () => {
  const { container, iframe } = createPostContainer();
  const transport = createRecordingTransport();
  const unmount = mountNewPostFormulary(container, {}, transport);

  withHostDocument(null, () => {
    deliverBridgeMessage(transport, "resized", { frameId: "new-post-formulary", height: 320 });
  });
  assert.equal(iframe.style.height, "0px");

  unmount();
});

test("a submitted post reaches onFormSubmitted, and is ignored without one", () => {
  const submitted = [];
  const withCallback = createPostContainer();
  const callbackTransport = createRecordingTransport();
  const unmountWithCallback = mountNewPostFormulary(
    withCallback.container,
    { onFormSubmitted: (payload) => submitted.push(payload) },
    callbackTransport,
  );
  deliverBridgeMessage(callbackTransport, "post-submitted", { content: "Hello" });
  assert.deepEqual(submitted, [{ content: "Hello" }]);
  unmountWithCallback();

  const withoutCallback = createPostContainer();
  const silentTransport = createRecordingTransport();
  const unmountWithoutCallback = mountNewPostFormulary(withoutCallback.container, {}, silentTransport);
  assert.doesNotThrow(() => deliverBridgeMessage(silentTransport, "post-submitted", { content: "Hi" }));
  unmountWithoutCallback();
});

test("after cleanup, resize and submit messages no longer reach the post frame", () => {
  const { container, iframe } = createPostContainer();
  const transport = createRecordingTransport();
  const submitted = [];
  const unmount = mountNewPostFormulary(
    container,
    { onFormSubmitted: (payload) => submitted.push(payload) },
    transport,
  );
  unmount();

  withHostDocument(iframe, () => {
    deliverBridgeMessage(transport, "resized", { frameId: "new-post-formulary", height: 320 });
    deliverBridgeMessage(transport, "post-submitted", { content: "Late" });
  });
  assert.equal(iframe.style.height, "0px");
  assert.deepEqual(submitted, []);
});
