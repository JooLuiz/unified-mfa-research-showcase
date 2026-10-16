import { navigateToUrl } from "single-spa";
import { publishRenderRequested } from "../events/eventBus";
import { isSinglePostPath } from "./singlePostRoute";

/**
 * Navigates to path, forcing a remount when needed.
 * Role: Delegates to single-spa's navigateToUrl, then additionally publishes a render request
 *   when the navigation stays within the single-post route but points at a different post.
 *   single-spa only (re)mounts an application when its activeWhen result flips from false to
 *   true; going from one "/posts/:id" to another "/posts/:id" never flips
 *   activeOnSinglePostPath (src/main.js), so without this the already-mounted page would keep
 *   showing the previous post even though the address bar now shows the new one.
 * Not in this file: The actual remount (src/main.js's reloadActivePageApp, triggered by
 *   publishRenderRequested).
 * Key dependencies: single-spa; src/events/eventBus.js; src/utils/singlePostRoute.js.
 * See also: src/main.js; src/notifications/notificationCenter.js (the toast-click case this
 *   was written for).
 *
 * @param {string} path - Destination path, optionally with a query string.
 * @returns {void}
 * @sideEffects Pushes a new history entry via single-spa and may trigger a page remount.
 */
function navigate(path) {
  const previousPathName = window.location.pathname;
  const [nextPathName] = path.split("?");

  navigateToUrl(path);

  if (
    isSinglePostPath(previousPathName) &&
    isSinglePostPath(nextPathName) &&
    previousPathName !== nextPathName
  ) {
    publishRenderRequested();
  }
}

export { navigate };
