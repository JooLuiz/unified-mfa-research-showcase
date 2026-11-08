/**
 * Verifies the stock SSE registry delivers a snapshot to one stream and a change to every
 * watcher of that product.
 * Role: Exercises createStockEventStream with fake response objects.
 * Not in this file: Availability math or the PUT /stock/watching route.
 * Key dependencies: node:test; src/infrastructure/stockEventStream.js.
 * See also: src/infrastructure/stockEventStream.js; src/routes/stockRoutes.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createStockEventStream } = require("./stockEventStream");

/**
 * Records SSE frames written to one connection.
 *
 * @returns {{ write: (frame: string) => void, frames: string[] }} Fake response.
 */
function createFakeResponse() {
  const frames = [];
  return {
    frames,
    write(frame) {
      frames.push(frame);
    },
  };
}

test("setWatchedProductIds returns nothing for a stream that was never registered", () => {
  const stockEventStream = createStockEventStream();
  const watchedProductIds = stockEventStream.setWatchedProductIds("missing-stream", ["p-01"]);
  assert.deepEqual(watchedProductIds, []);
});

test("writeStockChanged reaches only the stream that just registered", () => {
  const stockEventStream = createStockEventStream();
  const registeredResponse = createFakeResponse();
  const otherResponse = createFakeResponse();
  stockEventStream.registerStream("stream-a", registeredResponse);
  stockEventStream.registerStream("stream-b", otherResponse);

  const watchedProductIds = stockEventStream.setWatchedProductIds("stream-a", ["p-01", 12, "p-01"]);
  assert.deepEqual(watchedProductIds, ["p-01"]);

  stockEventStream.writeStockChanged("stream-a", "p-01", 1);
  stockEventStream.writeStockChanged("closed-stream", "p-01", 0);

  assert.deepEqual(registeredResponse.frames, [
    'event: stock_changed\ndata: {"productId":"p-01","available":1}\n\n',
  ]);
  assert.deepEqual(otherResponse.frames, []);
});

test("broadcastStockChanged still reaches every stream watching the product", () => {
  const stockEventStream = createStockEventStream();
  const firstResponse = createFakeResponse();
  const secondResponse = createFakeResponse();
  stockEventStream.registerStream("stream-a", firstResponse);
  stockEventStream.registerStream("stream-b", secondResponse);
  stockEventStream.setWatchedProductIds("stream-a", ["p-01"]);
  stockEventStream.setWatchedProductIds("stream-b", ["p-01"]);

  stockEventStream.broadcastStockChanged("p-01", 0);

  const expectedFrame = 'event: stock_changed\ndata: {"productId":"p-01","available":0}\n\n';
  assert.deepEqual(firstResponse.frames, [expectedFrame]);
  assert.deepEqual(secondResponse.frames, [expectedFrame]);
});
