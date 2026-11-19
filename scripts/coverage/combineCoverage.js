/**
 * Merges unit and end-to-end V8 coverage into one report.
 * Role: Reads the raw directories produced by runUnitCoverage.js, the Playwright e2e run, and the mock server, adds every untested src file at 0%, and writes a combined monocart report.
 * Not in this file: Collecting V8 ranges (see runUnitCoverage.js, e2e/fixtures.js, and apps/mock-data-service/scripts/devServer.js) or deciding which sources count (see coverageFilters.js).
 * Key dependencies: monocart-coverage-reports; scripts/coverage/coverageFilters.js.
 * See also: package.json (coverage script); playwright.config.js.
 */

const { existsSync, readdirSync, readFileSync, rmSync, statSync } = require("node:fs");
const path = require("node:path");
const {
  E2E_RAW_DIR,
  SERVER_RAW_DIR,
  UNIT_RAW_DIR,
  V8_DIR_SERVER,
  isAppSource,
  toRepoSourcePath,
} = require("./coverageFilters");

generateCombinedReport().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Confirms a raw directory has V8 coverage and a source file for every entry.
 *
 * @param {string} rawDir Directory written by the Monocart raw report.
 * @returns {void}
 * @throws {Error} When the directory, a coverage file, or a source file is missing or invalid.
 */
function assertRawCoverage(rawDir) {
  if (!existsSync(rawDir) || !statSync(rawDir).isDirectory()) {
    throw new Error(`Missing coverage raw directory: ${rawDir}`);
  }

  const coverageFiles = readdirSync(rawDir).filter(
    (fileName) => fileName.startsWith("coverage-") && fileName.endsWith(".json"),
  );
  let hasCoverageData = false;

  for (const fileName of coverageFiles) {
    const coverage = JSON.parse(readFileSync(path.join(rawDir, fileName), "utf8"));
    if (coverage.type !== "v8" || !Array.isArray(coverage.data)) {
      throw new Error(`Invalid raw coverage: ${path.join(rawDir, fileName)}`);
    }
    if (coverage.data.length > 0) {
      hasCoverageData = true;
    }
    for (const entry of coverage.data) {
      const sourceFile = path.join(rawDir, `source-${entry.id}.json`);
      if (!existsSync(sourceFile)) {
        throw new Error(`Missing raw source: ${sourceFile}`);
      }
      const source = JSON.parse(readFileSync(sourceFile, "utf8"));
      if (source.id !== entry.id || typeof source.source !== "string") {
        throw new Error(`Invalid raw source: ${sourceFile}`);
      }
    }
  }

  if (!hasCoverageData) {
    throw new Error(`Empty coverage raw directory: ${rawDir}`);
  }
}

/**
 * Turns Node V8 files from the mock server into a monocart raw directory.
 *
 * @returns {Promise<boolean>} True when that raw directory has coverage to merge.
 * @sideEffects Writes coverage/server/raw when coverage/.v8/server has Node V8 files.
 */
async function exportServerRawCoverage() {
  if (!existsSync(V8_DIR_SERVER) || !statSync(V8_DIR_SERVER).isDirectory()) {
    return false;
  }
  const coverageFiles = readdirSync(V8_DIR_SERVER).filter(
    (fileName) => fileName.startsWith("coverage-") && fileName.endsWith(".json"),
  );
  if (coverageFiles.length === 0) {
    return false;
  }

  rmSync("coverage/server", { recursive: true, force: true });
  const { CoverageReport } = await import("monocart-coverage-reports");
  const report = new CoverageReport({
    name: "Server coverage",
    outputDir: "coverage/server",
    reports: [["raw", { outputDir: "raw" }]],
    entryFilter: (entry) => isAppSource(entry.url),
    sourceFilter: (sourcePath) => isAppSource(sourcePath),
    sourcePath: (filePath, info) => toRepoSourcePath(filePath, info),
  });
  await report.addFromDir(V8_DIR_SERVER);
  await report.generate();
  return existsSync(SERVER_RAW_DIR);
}

/**
 * Loads the unit, browser, and server raw directories into one CoverageReport.
 *
 * @returns {Promise<void>}
 * @throws {Error} When the unit or end-to-end raw directory is missing or incomplete.
 * @sideEffects Writes coverage/combined. Writes coverage/server/raw when server V8 files exist.
 */
async function generateCombinedReport() {
  assertRawCoverage(UNIT_RAW_DIR);
  assertRawCoverage(E2E_RAW_DIR);
  const includeServerCoverage = await exportServerRawCoverage();
  if (includeServerCoverage) {
    assertRawCoverage(SERVER_RAW_DIR);
  }

  const { CoverageReport } = await import("monocart-coverage-reports");
  const report = new CoverageReport({
    name: "Combined coverage",
    inputDir: includeServerCoverage
      ? [UNIT_RAW_DIR, E2E_RAW_DIR, SERVER_RAW_DIR]
      : [UNIT_RAW_DIR, E2E_RAW_DIR],
    outputDir: "coverage/combined",
    reports: [["v8"], ["console-summary"]],
    sourcePath: (filePath, info) => toRepoSourcePath(filePath, info),
    all: {
      dir: ["apps", "packages"],
      filter: (filePath) => isAppSource(filePath),
    },
    sourceFilter: (sourcePath) => isAppSource(sourcePath),
  });
  await report.generate();
}
