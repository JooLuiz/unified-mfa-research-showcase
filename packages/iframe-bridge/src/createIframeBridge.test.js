/**
 * Verifies iframe-bridge messages on an injected transport.
 * Role: Locks topic, event, payload, and distributed scope for createIframeBridge.
 * Not in this file: createPostMessageTransport and host iframe mounting.
 * Key dependencies: node:test; src/createIframeBridge.js; test/support/createRecordingTransport.js.
 * See also: src/createIframeBridge.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FAQ_SUBMITTED_EVENT,
  GO_SHOPPING_EVENT,
  POST_SUBMITTED_EVENT,
  RESIZED_EVENT,
} from "./iframeBridgeContracts.js";
import { createIframeBridge } from "./createIframeBridge.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("publishIframeMessage emits each bridge event on the distributed topic", () => {
  const transport = createRecordingTransport();
  const iframeBridge = createIframeBridge(transport);
  const resize = { height: 240 };
  const faq = { question: "Where is my order?" };
  const post = { content: "Hello" };

  iframeBridge.publishIframeMessage(RESIZED_EVENT, resize);
  iframeBridge.publishIframeMessage(FAQ_SUBMITTED_EVENT, faq);
  iframeBridge.publishIframeMessage(POST_SUBMITTED_EVENT, post);
  iframeBridge.publishIframeMessage(GO_SHOPPING_EVENT);

  assert.deepEqual(transport.published, [
    { topic: "iframe-bridge", event: "resized", payload: resize, scope: "distributed" },
    { topic: "iframe-bridge", event: "faq-submitted", payload: faq, scope: "distributed" },
    { topic: "iframe-bridge", event: "post-submitted", payload: post, scope: "distributed" },
    { topic: "iframe-bridge", event: "go-shopping", payload: undefined, scope: "distributed" },
  ]);
});

test("subscribeToIframeEvent delivers the payload until unsubscribe", () => {
  const transport = createRecordingTransport();
  const iframeBridge = createIframeBridge(transport);
  const received = [];
  const unsubscribe = iframeBridge.subscribeToIframeEvent(FAQ_SUBMITTED_EVENT, (payload) => {
    received.push(payload);
  });

  iframeBridge.publishIframeMessage(FAQ_SUBMITTED_EVENT, { question: "Shipping?" });
  unsubscribe();
  iframeBridge.publishIframeMessage(FAQ_SUBMITTED_EVENT, { question: "Later" });

  assert.deepEqual(received, [{ question: "Shipping?" }]);
});
