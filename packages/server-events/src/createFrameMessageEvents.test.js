/**
 * Verifies the iframe-bridge window message channel.
 * Role: Locks which bridge messages are posted, where they go, and which incoming messages reach a subscriber.
 * Not in this file: Bridge operations (packages/iframe-bridge/src/createIframeBridge.js) or iframe mounting.
 * Key dependencies: node:test; src/createFrameMessageEvents.js; @shared/iframe-bridge.
 * See also: src/createFrameMessageEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FAQ_SUBMITTED_EVENT,
  IFRAME_BRIDGE_MESSAGE_EVENT,
  IFRAME_BRIDGE_TOPIC,
  RESIZED_EVENT,
} from "@shared/iframe-bridge";
import { createFrameMessageEvents } from "./createFrameMessageEvents.js";

/**
 * Builds a window that records posted messages and keeps message listeners.
 *
 * @returns {{ posted: object[], listeners: Set<Function>, postMessage: Function, addEventListener: Function, removeEventListener: Function, dispatchMessage: (data: unknown) => void, parent: object }} Fake window.
 */
function createFakeWindow() {
  const fakeWindow = {
    posted: [],
    listeners: new Set(),
    postMessage(message, targetOrigin) {
      fakeWindow.posted.push({ message, targetOrigin });
    },
    addEventListener(type, listener) {
      if (type === "message") {
        fakeWindow.listeners.add(listener);
      }
    },
    removeEventListener(type, listener) {
      if (type === "message") {
        fakeWindow.listeners.delete(listener);
      }
    },
    dispatchMessage(data) {
      for (const listener of fakeWindow.listeners) {
        listener({ data });
      }
    },
  };
  fakeWindow.parent = fakeWindow;
  return fakeWindow;
}

/**
 * Runs a test body with a fake global window, then restores the previous one.
 *
 * @param {(fakeWindow: ReturnType<typeof createFakeWindow>) => void} body - Test body.
 * @returns {void}
 */
function withFakeWindow(body) {
  const previousWindow = globalThis.window;
  const fakeWindow = createFakeWindow();
  globalThis.window = fakeWindow;
  try {
    body(fakeWindow);
  } finally {
    if (previousWindow) {
      globalThis.window = previousWindow;
    } else {
      delete globalThis.window;
    }
  }
}

function bridgeMessage(payload) {
  return { topic: IFRAME_BRIDGE_TOPIC, event: IFRAME_BRIDGE_MESSAGE_EVENT, payload };
}

test("publish posts nothing for another event or an unmapped action", () => {
  withFakeWindow((fakeWindow) => {
    const channel = createFrameMessageEvents();

    channel.publish({ topic: IFRAME_BRIDGE_TOPIC, event: "other", payload: { event: RESIZED_EVENT } });
    channel.publish(bridgeMessage({ event: "unknown-action" }));
    channel.publish(bridgeMessage({ event: 42 }));
    channel.publish(bridgeMessage(null));
    channel.publish(bridgeMessage({}));

    assert.deepEqual(fakeWindow.posted, []);
  });
});

test("publish posts the type alone, or the type with the inner payload", () => {
  withFakeWindow((fakeWindow) => {
    const channel = createFrameMessageEvents();

    channel.publish(bridgeMessage({ event: RESIZED_EVENT }));
    channel.publish(bridgeMessage({ event: RESIZED_EVENT, payload: { height: 320 } }));

    assert.deepEqual(fakeWindow.posted, [
      { message: { type: "iframe:resize" }, targetOrigin: "*" },
      { message: { type: "iframe:resize", payload: { height: 320 } }, targetOrigin: "*" },
    ]);
  });
});

test("publish posts to the parent window inside an iframe", () => {
  withFakeWindow((fakeWindow) => {
    const parentWindow = createFakeWindow();
    fakeWindow.parent = parentWindow;
    const channel = createFrameMessageEvents();

    channel.publish(bridgeMessage({ event: FAQ_SUBMITTED_EVENT, payload: { id: "faq-01" } }));

    assert.deepEqual(fakeWindow.posted, []);
    assert.deepEqual(parentWindow.posted, [
      { message: { type: "faq:form-submitted", payload: { id: "faq-01" } }, targetOrigin: "*" },
    ]);
  });
});

test("subscribe to an unmapped event adds no listener and returns a no-op", () => {
  withFakeWindow((fakeWindow) => {
    const channel = createFrameMessageEvents();
    const received = [];

    const unsubscribe = channel.subscribe(IFRAME_BRIDGE_TOPIC, "other", (message) => {
      received.push(message);
    });
    fakeWindow.dispatchMessage({ type: "iframe:resize" });
    unsubscribe();

    assert.equal(fakeWindow.listeners.size, 0);
    assert.deepEqual(received, []);
  });
});

test("subscribe ignores empty, non-object, and unknown messages", () => {
  withFakeWindow((fakeWindow) => {
    const channel = createFrameMessageEvents();
    const received = [];

    channel.subscribe(IFRAME_BRIDGE_TOPIC, IFRAME_BRIDGE_MESSAGE_EVENT, (message) => {
      received.push(message);
    });
    fakeWindow.dispatchMessage(null);
    fakeWindow.dispatchMessage("iframe:resize");
    fakeWindow.dispatchMessage({ type: "unknown:type" });

    assert.deepEqual(received, []);
  });
});

test("subscribe delivers a known message until unsubscribed", () => {
  withFakeWindow((fakeWindow) => {
    const channel = createFrameMessageEvents();
    const received = [];

    const unsubscribe = channel.subscribe(
      IFRAME_BRIDGE_TOPIC,
      IFRAME_BRIDGE_MESSAGE_EVENT,
      (message) => {
        received.push(message);
      },
    );
    fakeWindow.dispatchMessage({ type: "iframe:resize", payload: { height: 480 } });
    unsubscribe();
    fakeWindow.dispatchMessage({ type: "iframe:resize", payload: { height: 640 } });

    assert.deepEqual(received, [
      { payload: { event: RESIZED_EVENT, payload: { height: 480 } } },
    ]);
    assert.equal(fakeWindow.listeners.size, 0);
  });
});
