/**
 * Verifies the FAQ iframe host builds a FAQ url and clears itself on cleanup.
 * Role: Locks the iframe markup both comparison branches write for a named shopper.
 * Not in this file: How a submitted FAQ is delivered to the shell.
 * Key dependencies: node:test; src/faq-formulary.js; test/support/createRecordingTransport.js.
 * See also: src/faq-formulary.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import "../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

globalThis.__webpack_public_path__ = "http://localhost/";

const { mountFaqFormulary } = await loadAppModule(
  new URL("./faq-formulary.js", import.meta.url).href,
);

/**
 * Builds a container that records innerHTML and returns one iframe, or none.
 *
 * @param {{ withIframe?: boolean }} [options] - Whether querySelector finds the iframe.
 * @returns {{ container: object, iframe: { style: object } }} Mount target.
 */
function createFaqContainer({ withIframe = true } = {}) {
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

test("mounts an FAQ iframe for a named shopper and clears it on cleanup", () => {
  const { container, iframe } = createFaqContainer();
  const unmount = mountFaqFormulary(
    container,
    {
      userName: "Ada",
      userEmail: "ada@example.com",
    },
    createRecordingTransport(),
  );

  assert.match(container.innerHTML, /faq-formulary\.html/);
  assert.match(container.innerHTML, /type=faq/);
  assert.match(container.innerHTML, /name=Ada/);
  assert.match(container.innerHTML, /email=/);
  assert.equal(iframe.style.height, "0px");

  unmount();
  assert.equal(container.innerHTML, "");
});

test("a resize sets the FAQ iframe height and a submit calls onFormSubmitted", () => {
  const { container, iframe } = createFaqContainer();
  const submitted = [];
  const previousDocument = globalThis.document;
  globalThis.document = {
    querySelector(selector) {
      return selector.includes("faq-formulary") ? iframe : null;
    },
  };
  const transport = createRecordingTransport();
  const unmount = mountFaqFormulary(
    container,
    { onFormSubmitted: (payload) => submitted.push(payload) },
    transport,
  );

  try {
    transport.deliver("iframe-bridge", "message", { event: "resized", payload: null });
    transport.deliver("iframe-bridge", "message", {
      event: "resized",
      payload: { frameId: "other", height: 200 },
    });
    transport.deliver("iframe-bridge", "message", {
      event: "resized",
      payload: { frameId: "faq-formulary", height: "tall" },
    });
    assert.equal(iframe.style.height, "0px");

    transport.deliver("iframe-bridge", "message", {
      event: "resized",
      payload: { frameId: "faq-formulary", height: 40 },
    });
    assert.equal(iframe.style.height, "80px");

    transport.deliver("iframe-bridge", "message", {
      event: "resized",
      payload: { frameId: "faq-formulary", height: 220 },
    });
    assert.equal(iframe.style.height, "220px");

    transport.deliver("iframe-bridge", "message", {
      event: "faq-submitted",
      payload: { question: "Shipping?" },
    });
    assert.deepEqual(submitted, [{ question: "Shipping?" }]);
  } finally {
    unmount();
    if (previousDocument) {
      globalThis.document = previousDocument;
    } else {
      delete globalThis.document;
    }
  }
});

/**
 * Points document.querySelector at the FAQ iframe for one test body.
 *
 * @param {object | null} iframe - Element the host page finds, or null.
 * @param {() => void} body - Test steps.
 * @returns {void}
 */
function withHostDocument(iframe, body) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    querySelector(selector) {
      return selector.includes("faq-formulary") ? iframe : null;
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

test("a guest FAQ iframe has no prefill and mounts without an iframe element", () => {
  const { container } = createFaqContainer({ withIframe: false });
  const unmount = mountFaqFormulary(container, undefined, createRecordingTransport());

  assert.match(container.innerHTML, /type=faq/);
  assert.doesNotMatch(container.innerHTML, /name=|email=/);

  unmount();
  assert.equal(container.innerHTML, "");
});

test("a FAQ resize before the iframe is on the page changes nothing, and a submit without a callback is ignored", () => {
  const { container, iframe } = createFaqContainer();
  const transport = createRecordingTransport();
  const unmount = mountFaqFormulary(container, {}, transport);

  withHostDocument(null, () => {
    transport.deliver("iframe-bridge", "message", {
      event: "resized",
      payload: { frameId: "faq-formulary", height: 320 },
    });
  });
  assert.equal(iframe.style.height, "0px");
  assert.doesNotThrow(() =>
    transport.deliver("iframe-bridge", "message", {
      event: "faq-submitted",
      payload: { question: "Returns?" },
    }),
  );

  unmount();
});

test("after FAQ cleanup, resize and submit messages no longer reach the frame", () => {
  const { container, iframe } = createFaqContainer();
  const transport = createRecordingTransport();
  const submitted = [];
  const unmount = mountFaqFormulary(
    container,
    { onFormSubmitted: (payload) => submitted.push(payload) },
    transport,
  );
  unmount();

  withHostDocument(iframe, () => {
    transport.deliver("iframe-bridge", "message", {
      event: "resized",
      payload: { frameId: "faq-formulary", height: 320 },
    });
    transport.deliver("iframe-bridge", "message", {
      event: "faq-submitted",
      payload: { question: "Late" },
    });
  });
  assert.equal(iframe.style.height, "0px");
  assert.deepEqual(submitted, []);
});
