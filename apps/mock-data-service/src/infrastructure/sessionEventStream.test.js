/**
 * Unit tests for sessionEventStream.
 */

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { createSessionEventStream, SESSION_REVOKED_EVENT_NAME } = require("./sessionEventStream");

function createFakeResponse() {
  const response = new EventEmitter();
  response.chunks = [];
  response.ended = false;
  response.write = (chunk) => {
    response.chunks.push(chunk);
  };
  response.end = () => {
    response.ended = true;
    response.emit("close");
  };
  return response;
}

test("broadcastSessionRevoked pushes frame and closes only target user's clients", () => {
  const stream = createSessionEventStream();
  const aliceRes1 = createFakeResponse();
  const aliceRes2 = createFakeResponse();
  const bobRes = createFakeResponse();

  stream.rememberClient("u-alice", "c-1", aliceRes1);
  stream.rememberClient("u-alice", "c-2", aliceRes2);
  stream.rememberClient("u-bob", "c-3", bobRes);

  stream.broadcastSessionRevoked("u-alice");

  assert.equal(aliceRes1.chunks.length, 1);
  assert.match(aliceRes1.chunks[0], new RegExp(`^event: ${SESSION_REVOKED_EVENT_NAME}\n`));
  assert.equal(aliceRes1.ended, true);

  assert.equal(aliceRes2.chunks.length, 1);
  assert.equal(aliceRes2.ended, true);

  assert.equal(bobRes.chunks.length, 0);
  assert.equal(bobRes.ended, false);
});

test("forgetClient removes client when closed directly", () => {
  const stream = createSessionEventStream();
  const aliceRes = createFakeResponse();

  stream.rememberClient("u-alice", "c-1", aliceRes);
  aliceRes.emit("close");

  stream.broadcastSessionRevoked("u-alice");
  assert.equal(aliceRes.chunks.length, 0);
});
