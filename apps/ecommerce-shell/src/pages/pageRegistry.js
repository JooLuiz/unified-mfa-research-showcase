/**
 * Decides which ecommerce page a location shows, or where it must redirect first.
 * Role: Pure route table for the shell: legacy order links, the sign-in guard, and page keys.
 * Not in this file: Rendering (src/pages/pageRenderer.js) or history changes.
 * Key dependencies: src/utils/authActions.js route predicates.
 * See also: src/pages/pageRenderer.js.
 */

import { isAuthenticated, isOrderDetailsRoute, isProtectedRoute } from "../utils/authActions";

const EXACT_PAGE_KEYS = {
  "/": "home",
  "/products": "products",
  "/promotions": "promotions",
  "/product": "productDetails",
  "/checkout": "checkout",
  "/order-placed": "orderPlaced",
  "/login": "login",
  "/account": "account",
  "/notifications": "notifications",
};

/**
 * Resolves a location to a page key or a redirect.
 *
 * @param {{ pathname: string, search?: string }} location - Current location.
 * @param {object} appState - Shell state holding the session.
 * @returns {{ redirect: string, rememberPath?: string } | { page: string }} Route decision.
 *   rememberPath is the path to restore after sign-in.
 */
function resolvePageRoute(location, appState) {
  const pathName = location.pathname;
  const search = location.search || "";

  if (pathName === "/order-details") {
    const legacyOrderId = new URLSearchParams(search).get("orderId");
    if (legacyOrderId) {
      return { redirect: `/order-details/${encodeURIComponent(legacyOrderId)}` };
    }
  }

  if (isProtectedRoute(pathName) && !isAuthenticated(appState)) {
    return { redirect: "/login", rememberPath: pathName + search };
  }

  if (EXACT_PAGE_KEYS[pathName]) {
    return { page: EXACT_PAGE_KEYS[pathName] };
  }
  if (isOrderDetailsRoute(pathName)) {
    return { page: "orderDetails" };
  }
  return { page: "notFound" };
}

export { resolvePageRoute };
