/**
 * Updates browser history and requests admin shell rendering through Event Mesh.
 * Role: Provides route navigation without coupling route callers to the shell renderer.
 * Not in this file: Route matching, authentication guards, or page rendering.
 * Key dependencies: src/events/shellEventBus.js.
 * See also: src/main.js.
 */

import { publishRenderRequested } from "../events/shellEventBus";

/**
 * Navigates to a new in-shell path and publishes a render request.
 *
 * @param {string} path - Relative application path, including optional query parameters.
 * @returns {void}
 * @sideEffects Updates browser history and publishes a local navigation event.
 */
function navigate(path) {
  const currentFullPath = `${window.location.pathname}${window.location.search}`;
  if (path === currentFullPath || path === window.location.pathname) {
    return;
  }
  history.pushState({}, "", path);
  publishRenderRequested();
}

export { navigate };
