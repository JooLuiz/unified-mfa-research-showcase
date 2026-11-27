/**
 * Verifies how a JSON read response becomes a caller outcome.
 * Role: Locks readJsonOutcome, the one response reader shared by both comparison branches.
 * Not in this file: The other readers, whose input differs by branch (HTTP response vs gateway reply).
 * Key dependencies: node:test; src/readResponse.js.
 * See also: src/readResponse.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readJsonOutcome } from "./readResponse.js";

/**
 * Builds a fetch-like response.
 *
 * @param {{ status: number, body?: unknown, invalidJson?: boolean }} input - Status and JSON body.
 * @returns {{ ok: boolean, status: number, json: () => Promise<unknown> }} Response stand-in.
 */
function createResponse({ status, body, invalidJson = false }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (invalidJson ? Promise.reject(new SyntaxError("bad json")) : Promise.resolve(body)),
  };
}

test("a JSON read maps each response to the outcome a caller sees", async () => {
  const cases = [
    [{ status: 401, body: { code: "expired" } }, { ok: false, code: "unauthorized" }],
    [{ status: 404, body: { code: "order-not-found" } }, { ok: false, code: "order-not-found" }],
    [{ status: 500, body: {} }, { ok: false, code: "request-failed" }],
    [{ status: 502, invalidJson: true }, { ok: false, code: "request-failed" }],
    [{ status: 200, body: { id: "order-01" } }, { ok: true, order: { id: "order-01" } }],
  ];
  for (const [response, outcome] of cases) {
    assert.deepEqual(await readJsonOutcome(createResponse(response), "order"), outcome);
  }
});
