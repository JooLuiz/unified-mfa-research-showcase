/**
 * Bootstraps the empty-checkout iframe page without eager federated shares.
 * Role: Loads polyfills and the page module asynchronously so zone.js can fall back locally.
 * Not in this file: The empty-cart UI or iframe host mount.
 * Key dependencies: src/polyfills.ts; src/checkout-empty-page.ts.
 * See also: src/index.ts.
 */

async function bootstrapCheckoutEmptyPage(): Promise<void> {
  await import("./polyfills");
  await import("./checkout-empty-page");
}

bootstrapCheckoutEmptyPage().catch((error: unknown) => {
  console.error("bootstrapCheckoutEmptyPage - error");
  console.error(error);
});
