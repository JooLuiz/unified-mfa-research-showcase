/**
 * Runs the shared unit suite with V8 coverage on, then writes the unit coverage report.
 * Role: Sets NODE_V8_COVERAGE, reuses the existing `npm test` command so the test file list is not duplicated, and writes the unit HTML report plus coverage/unit/raw.
 * Not in this file: Deciding which files are app sources (see coverageFilters.js) or collecting browser coverage (see e2e/fixtures.js).
 * Key dependencies: monocart-coverage-reports; scripts/coverage/coverageFilters.js.
 * See also: package.json (test script); scripts/coverage/combineCoverage.js.
 */

const { spawnSync } = require("node:child_process");
const { rmSync, mkdirSync } = require("node:fs");
const { V8_DIR_UNIT, isAppSource } = require("./coverageFilters");

rmSync(V8_DIR_UNIT, { recursive: true, force: true });
mkdirSync(V8_DIR_UNIT, { recursive: true });
process.env.NODE_V8_COVERAGE = V8_DIR_UNIT;

const testResult = spawnSync("npm", ["test"], { stdio: "inherit", shell: true });
if (testResult.status !== 0) {
  process.exit(testResult.status ?? 1);
}

generateUnitReport().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Reads the V8 coverage written by `npm test` and writes the unit HTML report and raw export.
 *
 * @returns {Promise<void>}
 */
async function generateUnitReport() {
  const { CoverageReport } = await import("monocart-coverage-reports");
  const report = new CoverageReport({
    name: "Unit coverage",
    outputDir: "coverage/unit",
    reports: [["v8"], ["console-summary"], ["raw", { outputDir: "raw" }]],
    entryFilter: (entry) => isAppSource(entry.url),
    sourceFilter: (sourcePath) => isAppSource(sourcePath),
  });
  await report.addFromDir(V8_DIR_UNIT);
  await report.generate();
}
