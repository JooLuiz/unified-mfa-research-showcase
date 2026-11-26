/**
 * Decides which admin page a location shows, or where it must redirect first.
 * Role: Pure route table for the admin shell: the sign-in and admin-role gates and page keys.
 * Not in this file: Rendering (src/pages/pageRenderer.js), history changes, or session clearing.
 * Key dependencies: src/utils/authActions.js route and role predicates.
 * See also: src/pages/pageRenderer.js.
 */

import { isAdminAuthenticated, isAdminRoute } from "../utils/authActions";

const SINGLE_POST_ROUTE_PREFIX = "/posts/";
const ORDER_DETAILS_ROUTE_PREFIX = "/order-details/";

const EXACT_PAGE_KEYS = {
  "/login": "login",
  "/": "dashboard",
  "/orders": "orders",
  "/notifications": "notifications",
  "/posts": "posts",
  "/account": "account",
};

/**
 * Resolves a location to a page key or a redirect.
 *
 * @param {{ pathname: string, search?: string }} location - Current location.
 * @param {object} appState - Shell state holding the session.
 * @returns {{ redirect: string, rememberPath?: string, accessDenied?: boolean } | { page: string, postId?: string }}
 *   Route decision. accessDenied marks a signed-in account without the admin role.
 */
function resolvePageRoute(location, appState) {
  const pathName = location.pathname;

  if (isAdminRoute(pathName)) {
    if (!appState.authToken || !appState.currentUser) {
      return { redirect: "/login", rememberPath: pathName + (location.search || "") };
    }
    if (!isAdminAuthenticated(appState)) {
      return { redirect: "/login", accessDenied: true };
    }
  }

  if (EXACT_PAGE_KEYS[pathName]) {
    return { page: EXACT_PAGE_KEYS[pathName] };
  }
  if (pathName.startsWith(ORDER_DETAILS_ROUTE_PREFIX)) {
    return { page: "orderDetails" };
  }
  if (pathName.startsWith(SINGLE_POST_ROUTE_PREFIX)) {
    return { page: "singlePost", postId: pathName.slice(SINGLE_POST_ROUTE_PREFIX.length) };
  }
  return { page: "notFound" };
}

export { resolvePageRoute };
