/**
 * Verifies that app and package sources have no line terminators that break coverage mapping.
 * Role: Locks findStrayLineTerminators and fails when any source under apps/ or packages/ has a
 *   lone carriage return or U+2028 / U+2029.
 * Not in this file: Coverage collection or the combined report.
 * Key dependencies: node:test; scripts/coverage/lineTerminators.js.
 * See also: scripts/coverage/lineTerminators.js.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { findStrayLineTerminators, listSourceFiles } = require("./lineTerminators.js");

const repoRoot = path.resolve(__dirname, "../..");

test("LF and CRLF line endings are not stray terminators", () => {
  assert.deepEqual(findStrayLineTerminators("const a = 1;\nconst b = 2;\n"), []);
  assert.deepEqual(findStrayLineTerminators("const a = 1;\r\nconst b = 2;\r\n"), []);
});

test("a carriage return without a line feed is reported on its line", () => {
  assert.deepEqual(findStrayLineTerminators("const {\r  a,\r\n} = b;\r\nc,\rd"), [
    { line: 1, kind: "lone-cr" },
    { line: 3, kind: "lone-cr" },
  ]);
});

test("U+2028 and U+2029 are reported on their lines", () => {
  const text = `first\nsecond${String.fromCharCode(0x2028)}\nthird${String.fromCharCode(0x2029)}`;
  assert.deepEqual(findStrayLineTerminators(text), [
    { line: 2, kind: "U+2028" },
    { line: 3, kind: "U+2029" },
  ]);
});

test("source files are listed under apps/ and packages/ only, without dependencies or output", () => {
  const files = listSourceFiles(repoRoot);
  assert.equal(files.includes("scripts/coverage/lineTerminators.js"), false);
  assert.ok(files.some((file) => file.startsWith("apps/")));
  assert.ok(files.some((file) => file.startsWith("packages/")));
  assert.ok(files.every((file) => !/(^|\/)(node_modules|dist|coverage)\//.test(file)));
});

test("no app or package source has a stray line terminator", () => {
  const problems = listSourceFiles(repoRoot).flatMap((file) =>
    findStrayLineTerminators(fs.readFileSync(path.join(repoRoot, file), "utf8")).map(
      ({ line, kind }) => `${file}:${line} ${kind}`,
    ),
  );
  assert.deepEqual(problems, []);
});
