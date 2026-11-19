/**
 * Hides console output from unit files whose tests all passed.
 * Role: Filters the Node test-runner event stream before the spec reporter prints it.
 * Not in this file: Choosing which files run, or printing output when a file failed.
 * Key dependencies: node:stream; node:url; node:test/reporters.
 * See also: scripts/test/quietReporter.test.js; scripts/test/runUnitTests.js.
 */

import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { spec } from "node:test/reporters";

/**
 * Drops stdout and stderr for a file whose summary reports no failures.
 *
 * @param {AsyncIterable<{ type: string, data?: { entryFile?: string, file?: string, counts?: { failed?: number, cancelled?: number } } }>} source - Test-runner events.
 * @yields {{ type: string, data?: object }} Events the spec reporter should print.
 */
export async function* hidePassingOutput(source) {
  const heldByFile = new Map();
  const passedFiles = new Set();
  let finalSummary = null;
  for await (const event of source) {
    const file = eventFile(event);
    if (!file) {
      if (event.type === "test:summary") {
        finalSummary = event;
      }
      yield event;
      continue;
    }
    if (passedFiles.has(file)) {
      if (!isConsoleOutput(event)) {
        yield event;
      }
      continue;
    }
    const held = heldByFile.get(file) ?? [];
    held.push(event);
    heldByFile.set(file, held);
    if (event.type !== "test:summary") {
      continue;
    }
    const passed = filePassed(event);
    if (passed) {
      passedFiles.add(file);
    }
    yield* releaseFile(held, passed);
    heldByFile.delete(file);
  }
  const runPassed = finalSummary !== null && filePassed(finalSummary);
  for (const held of heldByFile.values()) {
    yield* releaseFile(held, runPassed);
  }
}

/**
 * Prints the filtered stream with Node's spec reporter.
 *
 * @param {AsyncIterable<object>} source - Test-runner events.
 * @yields {string} Spec-reporter text.
 */
export default async function* quietReporter(source) {
  const reporter = Readable.from(hidePassingOutput(source)).pipe(spec());
  for await (const chunk of reporter) {
    yield chunk;
  }
}

/**
 * Reads the test file that owns an event.
 *
 * @param {{ data?: { entryFile?: string, file?: string } }} event - One test-runner event.
 * @returns {string} Normalized path, or an empty string when the event is for the whole run.
 */
function eventFile(event) {
  return normalizeModulePath(event.data?.entryFile) || normalizeModulePath(event.data?.file);
}

/**
 * Turns a file URL or Windows path into one comparable path.
 *
 * @param {string | undefined} value - entryFile or file from a test-runner event.
 * @returns {string} Path with forward slashes, or an empty string when value is missing.
 */
function normalizeModulePath(value) {
  if (!value) {
    return "";
  }
  const decoded = value.startsWith("file:") ? fileURLToPath(value) : value;
  return decoded.replace(/\\/g, "/");
}

/**
 * Reports whether a file summary has nothing that should keep its console output.
 *
 * @param {{ data?: { counts?: { failed?: number, cancelled?: number } } }} summary - A per-file test:summary event.
 * @returns {boolean} True when the file recorded no failures and no cancellations.
 */
function filePassed(summary) {
  const counts = summary.data?.counts;
  if (!counts) {
    return false;
  }
  return (counts.failed ?? 0) === 0 && (counts.cancelled ?? 0) === 0;
}

/**
 * Reports console output captured for a test file.
 *
 * @param {{ type?: string }} event - One test-runner event.
 * @returns {boolean} True for stdout or stderr from that file.
 */
function isConsoleOutput(event) {
  return event.type === "test:stdout" || event.type === "test:stderr";
}

/**
 * Returns a file's events, omitting console output when the file passed.
 *
 * @param {object[]} held - Events buffered for one file, in arrival order.
 * @param {boolean} passed - True when that file's tests all passed.
 * @yields {object} Events to forward.
 */
function* releaseFile(held, passed) {
  for (const heldEvent of held) {
    if (passed && isConsoleOutput(heldEvent)) {
      continue;
    }
    yield heldEvent;
  }
}
