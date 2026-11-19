/**
 * Starts the mock data service for local dev and for end-to-end coverage.
 * Role: Spawns `src/server.js`. When `E2E_COVERAGE=1`, that child is the only process with `NODE_V8_COVERAGE` set.
 * Not in this file: Route handlers or writing the combined report.
 * Key dependencies: node:child_process; node:fs. The coverage directory is the repo-level `coverage/.v8/server`.
 * See also: apps/mock-data-service/src/server.js; scripts/coverage/combineCoverage.js.
 */

const { spawn } = require("node:child_process");
const { mkdirSync, rmSync } = require("node:fs");
const path = require("node:path");

const serverScript = path.join(__dirname, "../src/server.js");
const coverageDirectory = path.resolve(__dirname, "../../../coverage/.v8/server");
const env = { ...process.env };
const nodeArguments = [];

if (process.env.E2E_COVERAGE === "1") {
  rmSync(coverageDirectory, { recursive: true, force: true });
  mkdirSync(coverageDirectory, { recursive: true });
  env.NODE_V8_COVERAGE = coverageDirectory;
  nodeArguments.push("-r", path.join(__dirname, "flushServerCoverage.js"));
}

nodeArguments.push(serverScript);

const serverProcess = spawn(process.execPath, nodeArguments, {
  env,
  stdio: "inherit",
});

serverProcess.on("exit", (exitCode) => {
  process.exit(exitCode ?? 0);
});

process.on("SIGINT", () => {
  serverProcess.kill("SIGINT");
});
process.on("SIGTERM", () => {
  serverProcess.kill("SIGTERM");
});
