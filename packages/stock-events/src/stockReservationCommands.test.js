/**
 * Verifies stock hold commands return the server outcome.
 * Role: Locks accepted, rejected, unreadable, and unreachable results for reserve and set.
 * Not in this file: Live availability delivery or the wire format of either branch.
 * Key dependencies: node:test; src/stockReservationCommands.js; src/stockEventsContracts.js.
 * See also: src/stockReservationCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { STOCK_INSUFFICIENT_CODE } from "./stockEventsContracts.js";
import { reserveStockQuantity, setStockQuantity } from "./stockReservationCommands.js";

const API_BASE_URL = "http://localhost:4000/api";
let invokeLongTimerImmediately = false;

/**
 * Installs window timers the mesh command uses, and restores the previous window.
 *
 * @returns {() => void} Restores the previous window value.
 */
function installWindowTimers() {
  const originalWindow = globalThis.window;
  globalThis.window = {
    setTimeout(callback, delayMs) {
      if (invokeLongTimerImmediately && delayMs >= 10_000) {
        callback();
        return 0;
      }
      return setTimeout(callback, delayMs);
    },
    clearTimeout(timerId) {
      clearTimeout(timerId);
    },
  };
  return function restoreWindowTimers() {
    invokeLongTimerImmediately = false;
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  };
}

/**
 * Installs one fetch result and restores the previous fetch.
 *
 * @param {{ ok: boolean, status?: number, json?: () => Promise<object> } | Error} responseOrError - Scripted HTTP result.
 * @returns {() => void} Restores the previous fetch.
 */
function installFetch(responseOrError) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    if (responseOrError instanceof Error) {
      throw responseOrError;
    }
    return responseOrError;
  };
  return function restoreFetch() {
    globalThis.fetch = originalFetch;
  };
}

/**
 * Builds a command client that settles with the same outcome the HTTP branch returns.
 * A connection failure settles as a network error. Otherwise the reply event carries the outcome.
 *
 * @param {{ failConnection?: boolean, reply?: { ok: true, quantity: number, available: number } | { ok: false, code: string } }} script - Outcome both branches should surface.
 * @returns {{ subscribe: (topic: string, event: string, callback: (message: { payload?: object }) => void) => () => void, whenConnected: () => Promise<void>, publish: (message: { payload?: { requestId?: string } }) => void }} Command client.
 */
function createCommandClient({ failConnection = false, reply }) {
  const subscribers = [];
  return {
    subscribe(_topic, event, callback) {
      subscribers.push({ event, callback });
      callback({});
      callback({ payload: { requestId: "other-request" } });
      return function unsubscribe() {
        const index = subscribers.findIndex((subscriber) => subscriber.callback === callback);
        if (index >= 0) {
          subscribers.splice(index, 1);
        }
      };
    },
    whenConnected() {
      if (failConnection) {
        return Promise.reject(new Error("offline"));
      }
      return Promise.resolve();
    },
    publish(message) {
      if (!reply) {
        return;
      }
      const requestId = message.payload?.requestId;
      const replyEvent = reply.ok ? "accepted" : "rejected";
      const payload = reply.ok
        ? { requestId, quantity: reply.quantity, available: reply.available }
        : { requestId, code: reply.code };
      subscribers
        .filter((subscriber) => subscriber.event === replyEvent)
        .forEach((subscriber) => subscriber.callback({ payload }));
    },
  };
}

/**
 * Runs one stock command against a fetch script and a command client that agree on the outcome.
 *
 * @param {(input: object) => Promise<object>} command - reserveStockQuantity or setStockQuantity.
 * @param {{ authToken?: string, guestSessionId?: string, sessionId?: string, productId: string, quantity: number }} identity - Caller identity and the hold being changed.
 * @param {{ failConnection?: boolean, reply?: object, fetchResult: { ok: boolean, json?: () => Promise<object> } | Error }} script - Shared outcome setup.
 * @returns {Promise<object>} Command result.
 */
async function runStockCommand(command, identity, script) {
  invokeLongTimerImmediately = script.fireLongTimer === true;
  const restoreWindowTimers = installWindowTimers();
  const restoreFetch = installFetch(script.fetchResult);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    return await command({
      apiBaseUrl: API_BASE_URL,
      authToken: identity.authToken,
      guestSessionId: identity.guestSessionId,
      mesh: createCommandClient(script),
      sessionId: identity.sessionId,
      productId: identity.productId,
      quantity: identity.quantity,
    });
  } finally {
    console.warn = originalWarn;
    restoreFetch();
    restoreWindowTimers();
  }
}

test("reserveStockQuantity returns the accepted hold for a signed-in caller", async () => {
  const acceptedHold = { ok: true, quantity: 2, available: 8 };
  const result = await runStockCommand(
    reserveStockQuantity,
    { authToken: "token-01", productId: "p-01", quantity: 2 },
    {
      reply: acceptedHold,
      fetchResult: { ok: true, json: async () => ({ quantity: 2, available: 8 }) },
    },
  );

  assert.deepEqual(result, acceptedHold);
});

test("setStockQuantity returns the accepted hold for a guest session", async () => {
  const acceptedHold = { ok: true, quantity: 0, available: 11 };
  const result = await runStockCommand(
    setStockQuantity,
    { guestSessionId: "guest-01", sessionId: "guest-01", productId: "p-01", quantity: 0 },
    {
      reply: acceptedHold,
      fetchResult: { ok: true, json: async () => ({ quantity: 0, available: 11 }) },
    },
  );

  assert.deepEqual(result, acceptedHold);
});

test("reserveStockQuantity returns the server rejection code", async () => {
  const result = await runStockCommand(
    reserveStockQuantity,
    { authToken: "token-01", productId: "p-01", quantity: 9 },
    {
      reply: { ok: false, code: STOCK_INSUFFICIENT_CODE },
      fetchResult: { ok: false, json: async () => ({ code: STOCK_INSUFFICIENT_CODE }) },
    },
  );

  assert.deepEqual(result, { ok: false, code: STOCK_INSUFFICIENT_CODE });
});

test("reserveStockQuantity reports request-failed when the error body cannot be read", async () => {
  const result = await runStockCommand(
    reserveStockQuantity,
    { authToken: "token-01", productId: "p-01", quantity: 1 },
    {
      reply: { ok: false, code: "request-failed" },
      fetchResult: {
        ok: false,
        json: async () => {
          throw new Error("invalid json");
        },
      },
    },
  );

  assert.deepEqual(result, { ok: false, code: "request-failed" });
});

test("reserveStockQuantity reports network-error when the command cannot be delivered", async () => {
  const result = await runStockCommand(
    reserveStockQuantity,
    { authToken: "", guestSessionId: "", sessionId: "", productId: "p-01", quantity: 1 },
    {
      failConnection: true,
      fireLongTimer: true,
      fetchResult: new Error("offline"),
    },
  );

  assert.deepEqual(result, { ok: false, code: "network-error" });
});
