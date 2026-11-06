/**
 * Verifies RFC 4180-style escaping and CRLF documents.
 * Role: Exercises serializeCsv, including quoted fields, through its public function.
 * Not in this file: HTTP headers or resource-specific row mapping.
 * Key dependencies: node:test; src/csv/csvSerializer.js.
 * See also: src/csv/csvSerializer.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { serializeCsv } = require("./csvSerializer");

test("serializeCsv joins rows with CRLF and escapes commas, quotes, and newlines", () => {
  const csvContent = serializeCsv(
    ["note", "count"],
    [
      ["plain", 2],
      ["say \"hello\", friend", null],
      ["line one\nline two", ""],
    ],
  );

  assert.equal(
    csvContent,
    "note,count\r\nplain,2\r\n\"say \"\"hello\"\", friend\",\r\n\"line one\nline two\",\r\n",
  );
});
