/**
 * Resolves shell bootstrap imports to a module that fails evaluation.
 * Role: Lets a unit test run the bootstrap catch without loading the application.
 * Not in this file: Extensionless imports used by the rest of the suite.
 * Key dependencies: scripts/test/failingModule.mjs.
 * See also: apps/ecommerce-shell/src/shellBootstrap.test.js.
 */

const FAILING_MODULE_URL = new URL("./failingModule.mjs", import.meta.url).href;

/**
 * Drops encoding, slashes, and a query or hash so path checks see the module name.
 *
 * @param {string} value - Import specifier or parent URL.
 * @returns {string} Normalized path.
 */
function modulePath(value) {
  return decodeURIComponent(value).replace(/\\/g, "/").split(/[?#]/)[0];
}

/**
 * Reports a bootstrap file whose dynamic import should fail.
 *
 * @param {string | undefined} parentURL - Module that requested the import.
 * @returns {boolean} True for the three shell indexes and the empty-checkout entry.
 */
function isBootstrapParent(parentURL) {
  if (!parentURL) {
    return false;
  }
  const normalized = modulePath(parentURL);
  return (
    /\/apps\/(ecommerce-shell|social-media-shell|admin-shell)\/src\/index\.js$/.test(normalized) ||
    normalized.endsWith("/apps/checkout/src/checkout-empty-entry.ts")
  );
}

/**
 * Reports a shell or empty-checkout application import.
 *
 * @param {string} specifier - Relative request, or the absolute URL Node already resolved.
 * @returns {boolean} True when this import should fail instead of loading the application.
 */
function isApplicationImport(specifier) {
  const path = modulePath(specifier);
  return (
    path === "./main.js" ||
    path === "./main" ||
    path.endsWith("/main.js") ||
    path === "./polyfills" ||
    path === "./polyfills.ts" ||
    path.endsWith("/polyfills.ts") ||
    path === "./checkout-empty-page" ||
    path === "./checkout-empty-page.ts" ||
    path.endsWith("/checkout-empty-page.ts")
  );
}

/**
 * Sends a bootstrap's application import to the failing module.
 *
 * @param {string} specifier - Relative request, or the absolute URL Node already resolved.
 * @param {{ parentURL?: string }} context - Resolver context.
 * @param {(specifier: string, context: object) => Promise<object>} nextResolve - Next resolver.
 * @returns {Promise<{ url: string, shortCircuit?: boolean }>} Resolved module.
 */
export async function resolve(specifier, context, nextResolve) {
  if (isBootstrapParent(context.parentURL) && isApplicationImport(specifier)) {
    return { url: FAILING_MODULE_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
