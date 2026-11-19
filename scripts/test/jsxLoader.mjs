/**
 * Transforms JSX in shell modules while Node runs a unit test.
 * Role: Lets the test runner load React view modules without a bundler.
 * Not in this file: Assertions or a DOM.
 * Key dependencies: @babel/core; @babel/preset-react.
 * See also: test/support/loadAppModule.js.
 */

import { transformSync } from "@babel/core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const JSX_PATTERN = /<[A-Za-z/]/;

/**
 * Compiles a JavaScript module that contains JSX, keeping original line numbers.
 *
 * @param {string} url - File URL Node asked to load.
 * @param {object} context - Node load context.
 * @param {(url: string, context: object) => Promise<object>} nextLoad - The next loader.
 * @returns {Promise<object>} Transformed module source, or the next loader's result.
 */
export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !url.endsWith(".js")) {
    return nextLoad(url, context);
  }

  const filePath = fileURLToPath(url);
  const sourceText = readFileSync(filePath, "utf8");
  if (!JSX_PATTERN.test(sourceText)) {
    return nextLoad(url, context);
  }

  const transformed = transformSync(sourceText, {
    filename: filePath,
    babelrc: false,
    configFile: false,
    retainLines: true,
    presets: [["@babel/preset-react", { runtime: "automatic" }]],
  });

  return {
    format: "module",
    source: transformed.code,
    shortCircuit: true,
  };
}
