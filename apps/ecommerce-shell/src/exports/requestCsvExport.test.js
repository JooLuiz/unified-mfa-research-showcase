/**
 * Verifies the ecommerce orders export returns the transport outcome.
 * Role: Locks an accepted job id and an invalid rejection for kind orders.
 * Not in this file: Saving the downloaded file.
 * Key dependencies: node:test; src/exports/requestCsvExport.js; test/support/createRecordingTransport.js.
 * See also: src/exports/requestCsvExport.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { requestCsvExport } = await loadAppModule(
  new URL("./requestCsvExport.js", import.meta.url).href,
);

test("requestCsvExport returns a job id for an orders export", async () => {
  const transport = createRecordingTransport({
    requestReply: { ok: true, jobId: "job-01" },
  });

  const result = await requestCsvExport(transport, { kind: "orders" });

  assert.deepEqual(result, { ok: true, jobId: "job-01" });
  assert.deepEqual(transport.published, [
    { topic: "exports", event: "csv", payload: { kind: "orders" } },
  ]);
});

test("requestCsvExport returns an invalid rejection", async () => {
  const transport = createRecordingTransport({
    requestReply: { ok: false, code: "invalid" },
  });

  const result = await requestCsvExport(transport, { kind: "orders" });

  assert.deepEqual(result, { ok: false, code: "invalid" });
});
