/**
 * Finds line terminators that source maps and coverage tools count differently.
 * Role: Reports a carriage return without a following line feed, and U+2028 / U+2029, in app and
 *   package sources. Webpack source maps count lines only at "\n"; Monocart also breaks lines at
 *   these characters, so one of them shifts every later module in a bundle by a line and the
 *   combined report counts those files twice.
 * Not in this file: Fixing the files, or reading coverage data.
 * Key dependencies: node:fs; node:path.
 * See also: scripts/coverage/lineTerminators.test.js; scripts/coverage/combineCoverage.js.
 */

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_ROOTS = ["apps", "packages"];
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".vue"]);
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const STRAY_TERMINATOR_PATTERN = new RegExp(
  `\\r(?!\\n)|${LINE_SEPARATOR}|${PARAGRAPH_SEPARATOR}`,
  "g",
);

/**
 * Names one stray terminator character.
 *
 * @param {string} character - The matched character.
 * @returns {"lone-cr" | "U+2028" | "U+2029"} Kind reported to the caller.
 */
function describeTerminator(character) {
  if (character === LINE_SEPARATOR) {
    return "U+2028";
  }
  if (character === PARAGRAPH_SEPARATOR) {
    return "U+2029";
  }
  return "lone-cr";
}

/**
 * Lists each stray line terminator in a text, with its line counted by "\n".
 *
 * @param {string} text - File contents.
 * @returns {Array<{ line: number, kind: "lone-cr" | "U+2028" | "U+2029" }>} One entry per character found.
 */
function findStrayLineTerminators(text) {
  return [...text.matchAll(STRAY_TERMINATOR_PATTERN)].map((match) => ({
    line: text.slice(0, match.index).split("\n").length,
    kind: describeTerminator(match[0]),
  }));
}

/**
 * Lists app and package source files under a repository root.
 *
 * @param {string} rootDir - Repository root.
 * @returns {string[]} Repo-relative paths with "/" separators, sorted.
 */
function listSourceFiles(rootDir) {
  const files = [];

  /**
   * @param {string} directory - Absolute directory to walk.
   * @returns {void}
   * @sideEffects Appends matching files to `files`.
   */
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          walk(entryPath);
        }
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(path.relative(rootDir, entryPath).split(path.sep).join("/"));
      }
    }
  }

  SOURCE_ROOTS.map((root) => path.join(rootDir, root))
    .filter((directory) => fs.existsSync(directory))
    .forEach(walk);
  return files.sort();
}

module.exports = { findStrayLineTerminators, listSourceFiles };
