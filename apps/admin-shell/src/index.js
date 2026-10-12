/**
 * Bootstraps the admin shell after Module Federation initializes shared modules.
 * Role: Dynamic-imports the application so this host and the order-details remote share one order-status client.
 * Not in this file: Routing, the order-status stream, and page rendering (src/main.js).
 * Key dependencies: src/main.js.
 * See also: apps/ecommerce-shell/src/index.js.
 */

import("./main.js").catch((error) => {
  console.error("bootstrapAdminShell - error");
  console.error(error);
});
