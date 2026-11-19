/**
 * Loads a shell module after teaching Node to resolve extensionless relative imports.
 * Role: Shared setup for unit tests of webpack-authored shell modules.
 * Not in this file: Assertions.
 * Key dependencies: node:module; scripts/test/extensionlessResolver.mjs.
 * See also: apps/ecommerce-shell/src/utils/cartSync.test.js.
 */

import { register } from "node:module";

let registration;

/**
 * Registers the extensionless resolver once, then imports a module URL.
 *
 * @param {string} moduleUrl - Absolute file URL of the module under test.
 * @returns {Promise<object>} The module namespace.
 */
export async function loadAppModule(moduleUrl) {
  if (!registration) {
    registration = register(
      new URL("../../scripts/test/extensionlessResolver.mjs", import.meta.url),
      import.meta.url,
    );
  }
  if (registration && typeof registration.then === "function") {
    await registration;
  }
  return import(moduleUrl);
}
