/**
 * Verifies the CSV download outcome.
 * Role: Locks that a rejected response saves nothing, an accepted one saves one named file, and a failed body read cleans up nothing.
 * Not in this file: Which export path a shell calls (apps/*-shell/src/events/eventEndpoints.js).
 * Key dependencies: node:test; src/downloadCsvFile.js.
 * See also: src/downloadCsvFile.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { downloadCsvFile } from "./downloadCsvFile.js";

/**
 * Installs a document whose anchors record clicks and removal, and stubs object URLs.
 *
 * @param {import("node:test").TestContext} testContext - Restores the URL stubs after the test.
 * @returns {{ anchors: object[], appended: object[], revoked: string[] }} Recorded DOM and URL activity.
 * @sideEffects Assigns global document until the test ends.
 */
function installDownloadDocument(testContext) {
  const record = { anchors: [], appended: [], revoked: [] };
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement(tagName) {
      const anchor = {
        tagName,
        style: {},
        clicked: 0,
        removed: false,
        click() {
          anchor.clicked += 1;
        },
        remove() {
          anchor.removed = true;
        },
      };
      record.anchors.push(anchor);
      return anchor;
    },
    body: {
      appendChild(element) {
        record.appended.push(element);
      },
    },
  };
  testContext.mock.method(URL, "createObjectURL", () => "blob:csv-01");
  testContext.mock.method(URL, "revokeObjectURL", (objectUrl) => {
    record.revoked.push(objectUrl);
  });
  testContext.after(() => {
    if (previousDocument) {
      globalThis.document = previousDocument;
    } else {
      delete globalThis.document;
    }
  });
  return record;
}

test("a rejected response saves no file", async (testContext) => {
  const record = installDownloadDocument(testContext);

  const outcome = await downloadCsvFile({ ok: false }, "orders.csv");

  assert.deepEqual(outcome, { ok: false });
  assert.deepEqual(record.anchors, []);
  assert.deepEqual(record.revoked, []);
});

test("an accepted response saves one file with the given name", async (testContext) => {
  const record = installDownloadDocument(testContext);
  const response = { ok: true, blob: async () => new Blob(["id\n1\n"], { type: "text/csv" }) };

  const outcome = await downloadCsvFile(response, "orders.csv");

  assert.deepEqual(outcome, { ok: true });
  assert.equal(record.anchors.length, 1);
  const [anchor] = record.anchors;
  assert.equal(anchor.href, "blob:csv-01");
  assert.equal(anchor.download, "orders.csv");
  assert.equal(anchor.clicked, 1);
  assert.equal(anchor.removed, true);
  assert.deepEqual(record.appended, [anchor]);
  assert.deepEqual(record.revoked, ["blob:csv-01"]);
});

test("a body that cannot be read rejects without saving a file", async (testContext) => {
  const record = installDownloadDocument(testContext);
  const response = {
    ok: true,
    blob: async () => {
      throw new Error("body read failed");
    },
  };

  await assert.rejects(() => downloadCsvFile(response, "orders.csv"), /body read failed/);
  assert.deepEqual(record.anchors, []);
  assert.deepEqual(record.revoked, []);
});
