/**
 * Shared coverage filters and V8 output directories.
 * Role: Single source of truth for which scripts and sources count as application code, and for the unit and end-to-end raw directories the combined report merges.
 * Not in this file: Collecting V8 ranges, merging them, or writing reports.
 * Key dependencies: node:fs; node:path. The workspace directory map reads package.json names under apps and packages.
 * See also: scripts/coverage/coverageFilters.test.js; playwright.config.js; scripts/coverage/runUnitCoverage.js; scripts/coverage/combineCoverage.js.
 */

const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

const V8_DIR_UNIT = "coverage/.v8/unit";
const V8_DIR_E2E = "coverage/.v8/e2e";
const V8_DIR_SERVER = "coverage/.v8/server";
const UNIT_RAW_DIR = "coverage/unit/raw";
const E2E_RAW_DIR = "coverage/.v8/e2e/raw";
const SERVER_RAW_DIR = "coverage/server/raw";

const SHELL_ENTRY_APPS = new Set([
  "ecommerce-shell",
  "social-media-shell",
  "admin-shell",
]);

const appPorts = [
  4200, 4500, 4600, 4301, 4302, 4303, 4304, 4305, 4306, 4307, 4308, 4309, 4310,
  4311, 4312, 4313, 4314, 4315,
];

/**
 * Keeps scripts served by the shells and micro frontends.
 *
 * @param {string | undefined} url Script URL reported by Chromium.
 * @returns {boolean} True when the script belongs to an app dev server.
 */
function isAppScript(url) {
  if (!url) {
    return false;
  }
  const ignoredFragments = [
    "webpack-dev-server",
    "sockjs",
    "hot-update",
    "remoteEntry.js",
  ];
  if (ignoredFragments.some((fragment) => url.includes(fragment))) {
    return false;
  }
  return appPorts.some(
    (port) =>
      url.startsWith(`http://localhost:${port}/`) ||
      url.startsWith(`http://127.0.0.1:${port}/`),
  );
}

/**
 * Keeps original sources under an app or package src directory.
 *
 * @param {string | undefined} sourcePath Path or file URL Monocart reports for a script.
 * @returns {boolean} True when the file is application or shared-package source, excluding dependencies, tests, declarations, type-only files, and standalone preview entries.
 */
function isAppSource(sourcePath) {
  if (!sourcePath || sourcePath.includes("node_modules")) {
    return false;
  }
  const pathWithoutQuery = stripQueryAndHash(sourcePath);
  if (isExcludedSource(pathWithoutQuery)) {
    return false;
  }
  return /(?:^|[/\\])src[/\\]/.test(pathWithoutQuery);
}

/**
 * Removes a query string or hash so coverage identities ignore loader suffixes.
 *
 * @param {string} sourcePath Path or URL Monocart reports for a source.
 * @returns {string} The path before `?` or `#`.
 */
function stripQueryAndHash(sourcePath) {
  return sourcePath.split("?")[0].split("#")[0];
}

/**
 * Reports a source the combined report must not count.
 *
 * @param {string} sourcePath Path with any query or hash already removed.
 * @returns {boolean} True for tests, declarations, type-only files, Angular bootstrap, and standalone MFE preview entries.
 */
function isExcludedSource(sourcePath) {
  const normalized = sourcePath.replace(/\\/g, "/");
  if (
    normalized.endsWith(".test.js") ||
    normalized.endsWith(".d.ts") ||
    normalized.endsWith(".d.js") ||
    normalized.endsWith(".types.ts") ||
    normalized.endsWith("-types.ts") ||
    normalized.endsWith("/polyfills.ts") ||
    normalized.endsWith("/bootstrap-app.ts")
  ) {
    return true;
  }
  return isStandalonePreviewEntry(normalized);
}

/**
 * Reports an MFE preview entry the shells never load.
 *
 * @param {string} normalizedPath Forward-slash path with any query or hash already removed.
 * @returns {boolean} True for `apps/<mfe>/src/index.js` and `index.ts`. Shell bootstrap entries stay in the report.
 */
function isStandalonePreviewEntry(normalizedPath) {
  const previewIndex = normalizedPath.match(/(?:^|\/)apps\/(.+)\/src\/index\.(?:js|ts)$/);
  if (!previewIndex) {
    return false;
  }
  return !SHELL_ENTRY_APPS.has(previewIndex[1]);
}

/**
 * Maps a collected source onto the repo path Monocart uses for files read from disk.
 *
 * @param {string} filePath Path Monocart already normalized.
 * @param {{ url?: string } | undefined} info Original URL before normalization. Webpack source names are read from `info.url` because normalized paths drop `..`.
 * @returns {string} The workspace directory plus `src/...` for a webpack or absolute source, otherwise `filePath` without a query or hash.
 */
function toRepoSourcePath(filePath, info) {
  const originalUrl = info && typeof info.url === "string" ? info.url : filePath;
  const urlWithoutQuery = stripQueryAndHash(originalUrl);

  const packageSource = urlWithoutQuery.match(
    /^webpack:\/\/@apps\/[^/]+\/(?:\.\.\/)+packages\/([^/]+)\/src\/(.+)$/,
  );
  if (packageSource) {
    return `packages/${packageSource[1]}/src/${packageSource[2]}`;
  }

  const appSource = urlWithoutQuery.match(/^webpack:\/\/(@[^/]+\/[^/]+)\/\.\/src\/(.+)$/);
  if (appSource) {
    const directory = workspaceDirectory(appSource[1]) || `apps/${appSource[1].split("/")[1]}`;
    return `${directory}/src/${appSource[2]}`;
  }

  const fromOriginalUrl = repoRelativePath(urlWithoutQuery);
  if (fromOriginalUrl) {
    return fromOriginalUrl;
  }
  const fromFilePath = repoRelativePath(stripQueryAndHash(filePath));
  if (fromFilePath) {
    return fromFilePath;
  }

  return stripQueryAndHash(filePath);
}

/**
 * Converts a file URL or absolute path into a repo-relative path.
 *
 * @param {string} candidate File URL, absolute path, or path Monocart already normalized.
 * @returns {string | undefined} Repo-relative path using `/`, when the file sits inside this repo.
 */
function repoRelativePath(candidate) {
  if (!candidate || candidate.includes("webpack://")) {
    return undefined;
  }
  let absoluteCandidate = candidate;
  if (candidate.startsWith("file:")) {
    try {
      absoluteCandidate = fileURLToPath(candidate);
    } catch {
      return undefined;
    }
  }
  if (!path.isAbsolute(absoluteCandidate)) {
    absoluteCandidate = path.resolve(absoluteCandidate);
  }
  const relativePath = path.relative(path.resolve("."), absoluteCandidate);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }
  return relativePath.split(path.sep).join("/");
}

const WORKSPACE_ROOTS = ["apps", "packages"];
let workspaceDirectoryByPackageName;

/**
 * Resolves a workspace package name to its directory, relative to the repo root.
 *
 * @param {string} packageName Name from package.json, such as `@apps/global-layout-header`.
 * @returns {string | undefined} Repo-relative directory when that package is on disk.
 */
function workspaceDirectory(packageName) {
  if (!workspaceDirectoryByPackageName) {
    workspaceDirectoryByPackageName = readWorkspaceDirectories();
  }
  return workspaceDirectoryByPackageName.get(packageName);
}

/**
 * Reads package names under apps and packages.
 *
 * @returns {Map<string, string>} Package name to repo-relative directory.
 */
function readWorkspaceDirectories() {
  const directories = new Map();
  for (const root of WORKSPACE_ROOTS) {
    visitWorkspace(root, directories);
  }
  return directories;
}

/**
 * Records a directory's package name and visits nested workspace folders.
 *
 * @param {string} directory Repo-relative directory.
 * @param {Map<string, string>} directories Package name to directory.
 * @returns {void}
 */
function visitWorkspace(directory, directories) {
  if (!fs.existsSync(directory)) {
    return;
  }
  const manifestPath = path.join(directory, "package.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (typeof manifest.name === "string" && manifest.name) {
      directories.set(manifest.name, directory.split(path.sep).join("/"));
    }
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === "src" || entry.name === "dist") {
      continue;
    }
    visitWorkspace(path.join(directory, entry.name), directories);
  }
}

module.exports = {
  V8_DIR_UNIT,
  V8_DIR_E2E,
  V8_DIR_SERVER,
  UNIT_RAW_DIR,
  E2E_RAW_DIR,
  SERVER_RAW_DIR,
  isAppScript,
  isAppSource,
  toRepoSourcePath,
};
