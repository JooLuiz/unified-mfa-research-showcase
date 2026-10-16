/**
 * Identifies the single-post detail route ("/posts/:id").
 * Role: One shared predicate for the route's "/posts/" prefix (excluding the "/posts" list
 *   page itself), used both to decide which single-spa application is active for a path
 *   (src/main.js) and to detect same-route-type navigation that single-spa would not otherwise
 *   remount for (src/utils/navigate.js).
 * Not in this file: Route registration or the navigation call itself.
 * Key dependencies: None.
 * See also: src/main.js; src/utils/navigate.js.
 */

const SINGLE_POST_ROUTE_PREFIX = "/posts/";

/**
 * True when pathName is a single-post detail route, e.g. "/posts/abc123" — not the "/posts"
 * list page itself.
 *
 * @param {string} pathName - A URL pathname (no query string).
 * @returns {boolean} Whether pathName points at one specific post's detail page.
 */
function isSinglePostPath(pathName) {
  return pathName.startsWith(SINGLE_POST_ROUTE_PREFIX) && pathName !== "/posts";
}

export { isSinglePostPath };
