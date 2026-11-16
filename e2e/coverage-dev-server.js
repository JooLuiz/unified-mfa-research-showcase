/**
 * Adjusts an app's Webpack dev server for the end-to-end coverage run.
 *
 * Role: enables inline source maps and turns hot reload off when E2E_COVERAGE=1.
 * Not in this file: collecting V8 ranges, merging them, or writing the coverage report.
 * Key dependencies: Webpack configs under apps/.
 * See also: e2e/fixtures.js, playwright.config.js, README.md
 */

/**
 * Returns the Webpack config for a normal dev server, or for the coverage run.
 *
 * @param {object} config Config object exported by an app webpack.config.js.
 * @returns {object} The same config, or a copy with inline source maps and hot reload disabled.
 */
function applyE2eCoverage(config) {
  if (process.env.E2E_COVERAGE !== "1") {
    return config;
  }

  return {
    ...config,
    devtool: "inline-source-map",
    devServer: {
      ...config.devServer,
      hot: false,
    },
  };
}

module.exports = { applyE2eCoverage };
