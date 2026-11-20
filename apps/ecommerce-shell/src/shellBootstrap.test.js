/**
 * Verifies a failed shell bootstrap reports the error and does not reject the loader.
 * Role: Locks the catch path of the three shell indexes and the empty-checkout entry.
 * Not in this file: Application startup.
 * Key dependencies: node:test; node:module registerHooks; scripts/test/shellEntryResolver.mjs.
 * See also: apps/ecommerce-shell/src/index.js; apps/checkout/src/checkout-empty-entry.ts.
 */

import assert from "node:assert/strict";
import { register, registerHooks } from "node:module";
import test from "node:test";
import { redirectBootstrapSpecifier } from "../../../scripts/test/shellEntryResolver.mjs";

const CHECKOUT_BOOTSTRAP_ERROR = "bootstrapCheckoutEmptyPage - error";
const CHECKOUT_ERROR_WAIT_MS = 1000;
const CHECKOUT_ERROR_POLL_MS = 50;

registerHooks({
  /**
   * @param {string} specifier - Import specifier.
   * @param {{ parentURL?: string }} context - Resolve context.
   * @param {(specifier: string, context: object) => { url: string, shortCircuit?: boolean }} nextResolve - Next synchronous resolver.
   * @returns {{ url: string, shortCircuit?: boolean }} Resolved module.
   */
  resolve(specifier, context, nextResolve) {
    const redirectedUrl = redirectBootstrapSpecifier(specifier, context.parentURL);
    if (redirectedUrl) {
      return { url: redirectedUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const registration = register(
  "../../../scripts/test/shellEntryResolver.mjs",
  import.meta.url,
);
if (registration && typeof registration.then === "function") {
  await registration;
}

/**
 * Waits until the empty-checkout catch has logged, or the wait cap elapses.
 * Coverage can settle the redirected import on a later turn than setTimeout(0).
 *
 * @param {string[]} errors - Lines captured from console.error.
 * @returns {Promise<void>}
 */
async function waitForCheckoutBootstrapError(errors) {
  const deadline = Date.now() + CHECKOUT_ERROR_WAIT_MS;
  while (!errors.some((line) => line.includes(CHECKOUT_BOOTSTRAP_ERROR))) {
    if (Date.now() >= deadline) {
      return;
    }
    await new Promise((resolveWait) => {
      setTimeout(resolveWait, CHECKOUT_ERROR_POLL_MS);
    });
  }
}

/**
 * Collects console.error lines while the bootstrap modules load.
 *
 * @returns {Promise<string[]>} Error lines written by the bootstrap catch paths.
 */
async function loadBootstraps() {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => {
    errors.push(args.map((value) => String(value)).join(" "));
  };
  try {
    await import("./index.js");
    await import("../../admin-shell/src/index.js");
    await import("../../social-media-shell/src/index.js");
    await import("../../checkout/src/checkout-empty-entry.ts");
    await waitForCheckoutBootstrapError(errors);
  } finally {
    console.error = originalError;
  }
  return errors;
}

test("a shell that cannot load its application reports the failure", async () => {
  const errors = await loadBootstraps();
  const reported = errors.join("\n");

  assert.match(reported, /bootstrapEcommerceShell - error/);
  assert.match(reported, /bootstrapAdminShell - error/);
  assert.match(reported, /bootstrapSocialMediaShell - error/);
  assert.match(reported, /bootstrapCheckoutEmptyPage - error/);
  assert.match(reported, /bootstrap module failed/);
});
