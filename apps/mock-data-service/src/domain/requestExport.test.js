/**
 * Verifies the export request use case.
 * Role: Calls requestExport with an in-memory store and checks the returned outcome.
 * Not in this file: CSV content (src/domain/exportProcessing.test.js) or delivery.
 * Key dependencies: node:test; src/domain/requestExport.js; test/invokeRouter.js.
 * See also: src/domain/exportProcessing.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { requestExport } = require("./requestExport");
const { EXPORT_FILE_NAMES, EXPORT_KINDS } = require("./exportProcessing");
const { INVALID_REQUEST_CODE, USER_NOT_FOUND_CODE } = require("./useCaseCodes");
const { createMemoryJsonStore } = require("../../test/invokeRouter");

const shopper = { id: "u-01", username: "ada" };

function createStore() {
  return createMemoryJsonStore({ "users.json": [shopper] });
}

test("requestExport rejects a missing payload", async () => {
  const outcome = await requestExport({ jsonStore: createStore(), userId: "u-01", payload: null });

  assert.deepEqual(outcome, { ok: false, code: INVALID_REQUEST_CODE });
});

test("requestExport rejects an unknown kind", async () => {
  const outcome = await requestExport({ jsonStore: createStore(), userId: "u-01", payload: { kind: "users" } });

  assert.deepEqual(outcome, { ok: false, code: INVALID_REQUEST_CODE });
});

test("requestExport rejects an unknown user", async () => {
  const outcome = await requestExport({ jsonStore: createStore(), userId: "missing", payload: { kind: EXPORT_KINDS.orders } });

  assert.deepEqual(outcome, { ok: false, code: USER_NOT_FOUND_CODE });
});

test("requestExport resolves the user, kind, and file name for each kind", async () => {
  for (const kind of Object.values(EXPORT_KINDS)) {
    const outcome = await requestExport({ jsonStore: createStore(), userId: "u-01", payload: { kind } });

    assert.deepEqual(outcome, {
      ok: true,
      result: { user: shopper, kind, fileName: EXPORT_FILE_NAMES[kind] },
    });
  }
});
