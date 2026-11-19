/**
 * Verifies a failed shell bootstrap reports the error and does not reject the loader.
 * Role: Locks the catch path of the three shell indexes and the empty-checkout entry.
 * Not in this file: Application startup.
 * Key dependencies: node:test; scripts/test/shellEntryResolver.mjs.
 * See also: apps/ecommerce-shell/src/index.js; apps/checkout/src/checkout-empty-entry.ts.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

const registration = register(
  "../../../scripts/test/shellEntryResolver.mjs",
  import.meta.url,
);
if (registration && typeof registration.then === "function") {
  await registration;
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
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
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
