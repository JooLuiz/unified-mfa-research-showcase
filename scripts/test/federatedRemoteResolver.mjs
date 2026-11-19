/**
 * Resolves social shell remote imports to a local stub during unit tests.
 * Role: Lets page lifecycle tests mount without a webpack dev server.
 * Not in this file: The stub's mount functions (scripts/test/federatedRemoteStub.mjs).
 * Key dependencies: Node module register hooks.
 * See also: apps/social-media-shell/src/utils/pageApps.test.js.
 */

const STUB_URL = new URL("./federatedRemoteStub.mjs", import.meta.url).href;

const FEDERATED_SPECIFIERS = new Set([
  "global_layout_header/HeaderElement",
  "global_layout_footer/FooterElement",
  "product_showcase/ProductShowcaseElement",
  "banners/PromotionalBanner",
  "formulary/NewPostFormulary",
  "social_media_posts/PostFeed",
  "login/LoginForm",
  "notifications/Notifications",
  "single_post/SinglePost",
  "account/AccountProfile",
  "account/AccountAddress",
]);

/**
 * Sends known remote specifiers to the stub module.
 *
 * @param {string} specifier - Import specifier from the source file.
 * @param {object} context - Node resolve context.
 * @param {(specifier: string, context: object) => Promise<object>} nextResolve - The next resolver.
 * @returns {Promise<object>} Node resolve result.
 */
export async function resolve(specifier, context, nextResolve) {
  if (FEDERATED_SPECIFIERS.has(specifier)) {
    return { url: STUB_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
