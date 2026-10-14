/**
 * Bootstraps the social media shell after Module Federation initializes shared modules.
 * Role: Dynamic-imports the application so this host can consume the shared session-events singleton.
 * Not in this file: Routing, the session stream, and page rendering (src/main.js).
 * Key dependencies: src/main.js.
 * See also: apps/ecommerce-shell/src/index.js.
 */

import("./main.js").catch((error) => {
  console.error("bootstrapSocialMediaShell - error");
  console.error(error);
});
