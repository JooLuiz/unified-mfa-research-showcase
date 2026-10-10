/**
 * Bootstraps the ecommerce shell after Module Federation initializes shared modules.
 * Role: Dynamic-imports the application so the host can consume the shared mesh singleton.
 * Not in this file: App startup, routing, and stock gating (src/main.js).
 * Key dependencies: src/main.js.
 * See also: apps/checkout/src/index.ts.
 */

import("./main.js").catch((error) => {
  console.error("bootstrapEcommerceShell - error");
  console.error(error);
});
