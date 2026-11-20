/**
 * Resolves shell bootstrap imports to a module that fails evaluation.
 * Role: Lets a unit test run the bootstrap catch without loading the application.
 * Not in this file: Extensionless imports used by the rest of the suite.
 * Key dependencies: scripts/test/failingModule.mjs.
 * See also: apps/ecommerce-shell/src/shellBootstrap.test.js.
 */

const FAILING_MODULE_URL = new URL("./failingModule.mjs", import.meta.url).href;

const EMPTY_CHECKOUT_BASENAMES = new Set([
  "polyfills",
  "polyfills.ts",
  "checkout-empty-page",
  "checkout-empty-page.ts",
]);

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
 * Reports one of the three shell index modules.
 *
 * @param {string | undefined} parentURL - Module that requested the import.
 * @returns {boolean} True when the parent is ecommerce, admin, or social index.js.
 */
function isShellIndexParent(parentURL) {
  if (!parentURL) {
    return false;
  }
  return /\/apps\/(ecommerce-shell|social-media-shell|admin-shell)\/src\/index\.js$/.test(
    modulePath(parentURL),
  );
}

/**
 * Reports the application import made by a shell index.
 *
 * @param {string} specifier - Relative request, or the absolute URL Node already resolved.
 * @returns {boolean} True for ./main or ./main.js.
 */
function isShellApplicationImport(specifier) {
  const path = modulePath(specifier);
  return path === "./main.js" || path === "./main" || path.endsWith("/main.js");
}

/**
 * Reports the empty-checkout polyfill or page import.
 * Coverage may pass an absolute URL with no .ts suffix, so the basename is the identifier.
 * The parent is not checked: this resolver is registered only by the bootstrap test process.
 *
 * @param {string} specifier - Relative request, or the absolute URL Node already resolved.
 * @returns {boolean} True for polyfills or checkout-empty-page.
 */
function isEmptyCheckoutImport(specifier) {
  const basename = modulePath(specifier).split("/").pop();
  return EMPTY_CHECKOUT_BASENAMES.has(basename);
}

/**
 * Chooses the failing module when a bootstrap import must not load the application.
 *
 * @param {string} specifier - Relative request, or the absolute URL Node already resolved.
 * @param {string | undefined} parentURL - Module that requested the import.
 * @returns {string | null} URL of the module that throws, or null when this import should load normally.
 */
export function redirectBootstrapSpecifier(specifier, parentURL) {
  const shellImportFailed = isShellIndexParent(parentURL) && isShellApplicationImport(specifier);
  if (shellImportFailed || isEmptyCheckoutImport(specifier)) {
    return FAILING_MODULE_URL;
  }
  return null;
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
  const redirectedUrl = redirectBootstrapSpecifier(specifier, context.parentURL);
  if (redirectedUrl) {
    return { url: redirectedUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
