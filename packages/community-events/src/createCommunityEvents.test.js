/**
 * Verifies the community post-submitted message on an injected transport.
 * Role: Locks topic, event, payload, and scope for createCommunityEvents.
 * Not in this file: Post HTTP or iframe postMessage.
 * Key dependencies: node:test; src/createCommunityEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createCommunityEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createCommunityEvents } from "./createCommunityEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("publishPostSubmitted emits a local community message until unsubscribe", () => {
  const transport = createRecordingTransport();
  const communityEvents = createCommunityEvents(transport);
  const received = [];
  const unsubscribe = communityEvents.subscribeToPostSubmitted((payload) => {
    received.push(payload);
  });
  const post = { content: "Hello from the iframe" };

  communityEvents.publishPostSubmitted(post);
  unsubscribe();
  communityEvents.publishPostSubmitted({ content: "Later" });

  assert.deepEqual(transport.published, [
    { topic: "community", event: "post-submitted", payload: post, scope: "local" },
    { topic: "community", event: "post-submitted", payload: { content: "Later" }, scope: "local" },
  ]);
  assert.deepEqual(received, [post]);
});
