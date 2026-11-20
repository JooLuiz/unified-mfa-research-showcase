/**
 * Verifies passing unit files lose console output and the logs switch keeps it.
 * Role: Locks the quiet reporter filter and which Node arguments each command selects.
 * Not in this file: Running the suite or writing coverage.
 * Key dependencies: node:test; scripts/test/quietReporter.mjs; scripts/test/runUnitTests.js.
 * See also: scripts/test/quietReporter.mjs; scripts/test/runUnitTests.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { unitTestArguments } = require("./runUnitTests.js");

test("hidePassingOutput drops console output from a passing file and keeps it before a failure", async () => {
  const { hidePassingOutput } = await import("./quietReporter.mjs");
  const events = [
    { type: "test:stderr", data: { file: "pass.js", message: "pass-noise" } },
    { type: "test:pass", data: { file: "pass.js", name: "ok" } },
    { type: "test:summary", data: { file: "pass.js", counts: { failed: 0, cancelled: 0 } } },
    { type: "test:stderr", data: { file: "pass.js", message: "late-pass-noise" } },
    { type: "test:stderr", data: { file: "fail.js", message: "fail-noise" } },
    { type: "test:fail", data: { file: "fail.js", name: "bad" } },
    { type: "test:summary", data: { file: "fail.js", counts: { failed: 1, cancelled: 0 } } },
    { type: "test:stderr", data: { file: "fail.js", message: "late-fail-noise" } },
  ];
  const forwarded = [];
  for await (const event of hidePassingOutput(streamOf(events))) {
    forwarded.push(event);
  }

  assert.equal(forwarded.some((event) => event.data?.message === "pass-noise"), false);
  assert.equal(forwarded.some((event) => event.data?.message === "late-pass-noise"), false);
  assert.equal(forwarded.some((event) => event.data?.message === "late-fail-noise"), true);
  const failureIndex = forwarded.findIndex((event) => event.type === "test:fail");
  const noiseIndex = forwarded.findIndex((event) => event.data?.message === "fail-noise");
  assert.ok(noiseIndex >= 0);
  assert.ok(noiseIndex < failureIndex);
});

test("hidePassingOutput matches a file URL to the same Windows path", async () => {
  const { hidePassingOutput } = await import("./quietReporter.mjs");
  const windowsPath = "C:\\apps\\ecommerce-shell\\src\\pages\\accountPage.test.js";
  const entryUrl = "file:///C:/apps/ecommerce-shell/src/pages/accountPage.test.js";
  const events = [
    { type: "test:stderr", data: { entryFile: entryUrl, message: "url-pass-noise" } },
    { type: "test:pass", data: { entryFile: entryUrl, name: "ok" } },
    { type: "test:summary", data: { file: windowsPath, counts: { failed: 0, cancelled: 0 } } },
  ];
  const forwarded = [];
  for await (const event of hidePassingOutput(streamOf(events))) {
    forwarded.push(event);
  }

  assert.equal(forwarded.some((event) => event.data?.message === "url-pass-noise"), false);
  assert.equal(forwarded.some((event) => event.type === "test:pass"), true);
});

test("hidePassingOutput drops leftover console output only when the run passed", async () => {
  const { hidePassingOutput } = await import("./quietReporter.mjs");
  const passed = await collect(hidePassingOutput(streamOf([
    { type: "test:stderr", data: { file: "orphan.js", message: "orphan-noise" } },
    { type: "test:pass", data: { file: "orphan.js", name: "ok" } },
    { type: "test:summary", data: { counts: { failed: 0, cancelled: 0 } } },
  ])));
  const failed = await collect(hidePassingOutput(streamOf([
    { type: "test:stderr", data: { file: "orphan.js", message: "orphan-noise" } },
    { type: "test:summary", data: { counts: { failed: 1, cancelled: 0 } } },
  ])));

  assert.equal(passed.some((event) => event.data?.message === "orphan-noise"), false);
  assert.equal(passed.some((event) => event.type === "test:pass"), true);
  assert.equal(failed.some((event) => event.data?.message === "orphan-noise"), true);
});

test("unitTestArguments selects the quiet reporter without logs and spec with logs", () => {
  const quiet = unitTestArguments({ logs: false });
  const verbose = unitTestArguments({ logs: true });

  assert.ok(quiet.includes("--test-reporter=./scripts/test/quietReporter.mjs"));
  assert.ok(quiet.includes("--disable-warning=ExperimentalWarning"));
  assert.ok(quiet.includes("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"));
  assert.ok(verbose.includes("--test-reporter=spec"));
  assert.equal(verbose.includes("--disable-warning=ExperimentalWarning"), false);
  assert.equal(verbose.includes("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"), false);
  assert.ok(quiet.includes("--experimental-strip-types"));
  assert.ok(quiet.includes("--test-coverage-exclude=packages/server-events/**"));
  assert.ok(verbose.includes("--test-coverage-exclude=packages/server-events/**"));
  assert.ok(verbose.includes("--experimental-test-coverage"));
  assert.ok(quiet.includes("scripts/test/quietReporter.test.js"));
});

/**
 * Yields the given events in order.
 *
 * @param {object[]} events - Test-runner events.
 * @yields {object} The same events.
 */
async function* streamOf(events) {
  for (const event of events) {
    yield event;
  }
}

/**
 * Collects every event from a filtered stream.
 *
 * @param {AsyncIterable<object>} filtered - Events hidePassingOutput yields.
 * @returns {Promise<object[]>} The forwarded events.
 */
async function collect(filtered) {
  const forwarded = [];
  for await (const event of filtered) {
    forwarded.push(event);
  }
  return forwarded;
}
