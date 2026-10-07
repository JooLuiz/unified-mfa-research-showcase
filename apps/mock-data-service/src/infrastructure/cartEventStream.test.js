/**
 * Verifies per-user cart SSE delivery.
 * Role: Checks that a cart change reaches only that user's open responses, and that close drops one.
 * Not in this file: HTTP tickets or the ecommerce shell.
 * Key dependencies: node:test; src/infrastructure/cartEventStream.js.
 * See also: src/infrastructure/cartEventStream.js.
 */

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { createCartEventStream } = require("./cartEventStream");

/**
 * Builds a response stand-in that records writes and emits close.
 *
 * @returns {EventEmitter & { chunks: string[], write: (chunk: string) => void }} Fake SSE response.
 */
function createFakeResponse() {
  const response = new EventEmitter();
  response.chunks = [];
  response.write = (chunk) => {
    response.chunks.push(chunk);
  };
  return response;
}

test("broadcastCartChanged writes only to the matching user's open streams", () => {
  const cartEventStream = createCartEventStream();
  const aliceResponse = createFakeResponse();
  const brunoResponse = createFakeResponse();
  cartEventStream.registerClient("u-01", aliceResponse);
  cartEventStream.registerClient("u-02", brunoResponse);

  cartEventStream.broadcastCartChanged("u-01", {
    items: [{ productId: "p-01", quantity: 1 }],
    appliedCoupon: null,
    updatedAt: "2026-10-07T12:00:00.000Z",
  });

  assert.equal(aliceResponse.chunks.length, 1);
  assert.match(aliceResponse.chunks[0], /^event: cart_changed\n/);
  assert.match(aliceResponse.chunks[0], /"productId":"p-01"/);
  assert.equal(brunoResponse.chunks.length, 0);
});

test("a closed response no longer receives cart changes", () => {
  const cartEventStream = createCartEventStream();
  const aliceResponse = createFakeResponse();
  cartEventStream.registerClient("u-01", aliceResponse);
  aliceResponse.emit("close");

  cartEventStream.broadcastCartChanged("u-01", {
    items: [],
    appliedCoupon: null,
    updatedAt: "2026-10-07T12:01:00.000Z",
  });

  assert.equal(aliceResponse.chunks.length, 0);
});
