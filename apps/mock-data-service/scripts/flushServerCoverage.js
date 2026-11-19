/**
 * Writes Node V8 coverage while the mock server is still running.
 * Role: Flushes `NODE_V8_COVERAGE` on an interval so a hard stop of the dev process still leaves a report.
 * Not in this file: Starting the server or merging the report.
 * Key dependencies: node:v8. Loaded with `node -r` only when server coverage is on.
 * See also: apps/mock-data-service/scripts/devServer.js; scripts/coverage/combineCoverage.js.
 */

const { takeCoverage } = require("node:v8");

const flushTimer = setInterval(() => {
  takeCoverage();
}, 5000);
flushTimer.unref();
