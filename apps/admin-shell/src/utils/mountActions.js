/**
 * Mounts the admin header and footer custom elements.
 * Role: Creates layout chrome and supplies the header with admin display state.
 * Not in this file: Navigation, logout handling, or mesh configuration.
 * Key dependencies: global layout custom elements.
 * See also: src/main.js.
 */

import { isAuthenticated } from "./authActions";
import { navigate } from "./navigate";

function buildHeaderState(appState) {
  return {
    appType: "admin",
    totalPrice: 0,
    itemCount: 0,
    isAuthenticated: isAuthenticated(appState),
    currentUserName:
      appState.currentUser?.fullName || appState.currentUser?.username || "",
  };
}

function mountHeaderAndFooter(appState, layoutMounts, modules, activeCleanupFunctions) {
  const headerElement = document.createElement("react-header-mfe");
  headerElement.state = buildHeaderState(appState);
  layoutMounts.headerMount.appendChild(headerElement);

  if (isAuthenticated(appState) && modules?.mountNotificationBell) {
    setTimeout(() => {
      const bellSlot = headerElement.querySelector("#notificationBellMount");
      if (bellSlot) {
        const cleanupBell = modules.mountNotificationBell(bellSlot, {
          navigate,
        });
        if (typeof cleanupBell === "function" && Array.isArray(activeCleanupFunctions)) {
          activeCleanupFunctions.push(cleanupBell);
        }
      }
    }, 0);
  }

  const footerElement = document.createElement("vue-footer-mfe");
  footerElement.setAttribute(
    "message",
    "© 2026 Benchmark Micro Frontend Environment. All rights reserved.",
  );
  layoutMounts.footerMount.appendChild(footerElement);

  return headerElement;
}

/**
 * Refreshes the mounted header from the current session without remounting the page.
 *
 * @param {object} appState - Shell state holding the authenticated user.
 * @param {HTMLElement | null} headerElement - Header custom element from the last render.
 * @returns {void}
 * @sideEffects Replaces headerElement.state when the element is still mounted.
 */
function updateHeaderState(appState, headerElement) {
  if (!headerElement) {
    return;
  }
  headerElement.state = buildHeaderState(appState);
}

export { mountHeaderAndFooter, updateHeaderState };
