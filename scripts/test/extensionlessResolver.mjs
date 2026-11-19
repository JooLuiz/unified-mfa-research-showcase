/**
 * Resolves webpack-style relative imports for the Node test runner.
 * Role: Appends .js to extensionless relative specifiers so shell modules load under Node.
 * Not in this file: Package name resolution or TypeScript stripping.
 * Key dependencies: Node module register hooks.
 * See also: scripts/test/registerExtensionless.mjs.
 */

/**
 * Resolves one import specifier, adding .js when a relative path has no extension.
 *
 * @param {string} specifier - Import specifier from the source file.
 * @param {object} context - Node resolve context.
 * @param {(specifier: string, context: object) => Promise<object>} nextResolve - The next resolver.
 * @returns {Promise<object>} Node resolve result.
 */
const EMPTY_STYLE_URL = new URL("./emptyStyle.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    return { url: EMPTY_STYLE_URL, shortCircuit: true };
  }
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(specifier);
  if (isRelative && !hasExtension) {
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
}
