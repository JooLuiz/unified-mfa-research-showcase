/**
 * Mounts social shell header and footer Single-SPA applications.
 * Role: Adapts the shared header/footer MFEs to the social shell's auth and navigation events.
 * Not in this file: Authentication state persistence, mesh configuration, or page routing.
 * Key dependencies: src/events/eventBus.js; global layout custom elements.
 * See also: src/main.js.
 */

import { isAuthenticated } from "./authActions";
import { subscribeToAuthSessionChanges } from "../events/eventBus";
import { navigate } from "./navigate";

function buildHeaderState(appState) {
  return {
    appType: "social",
    totalPrice: 0,
    itemCount: 0,
    isAuthenticated: isAuthenticated(appState),
    currentUserName:
      appState.currentUser?.fullName || appState.currentUser?.username || "",
  };
}

/**
 * Creates the Single-SPA lifecycle for the social header.
 *
 * @returns {{ bootstrap: () => Promise<void>, mount: (mountProps: object) => Promise<void>, unmount: () => Promise<void> }} Single-SPA application lifecycle.
 */
function createHeaderApp() {
  let headerElement = null;
  let onAuthSessionChanged = null;
  let unsubscribeFromAuthSessionChanges = null;
  let storedAppState = null;

  function bootstrap() {
    return Promise.resolve();
  }

  let cleanupBell = null;

  function mount(mountProps) {
    const { appState, domElement, modules } = mountProps;
    storedAppState = appState;

    headerElement = document.createElement("react-header-mfe");
    headerElement.state = buildHeaderState(appState);

    const updateBellMount = () => {
      if (cleanupBell) {
        cleanupBell();
        cleanupBell = null;
      }
      if (headerElement && isAuthenticated(storedAppState) && modules?.mountNotificationBell) {
        const bellSlot = headerElement.querySelector("#notificationBellMount");
        if (bellSlot) {
          cleanupBell = modules.mountNotificationBell(bellSlot, {
            navigate,
          });
        }
      }
    };

    onAuthSessionChanged = () => {
      if (headerElement && storedAppState) {
        headerElement.state = buildHeaderState(storedAppState);
        setTimeout(updateBellMount, 0);
      }
    };

    unsubscribeFromAuthSessionChanges =
      subscribeToAuthSessionChanges(onAuthSessionChanged);

    domElement.appendChild(headerElement);
    setTimeout(updateBellMount, 0);
    return Promise.resolve();
  }

  function unmount() {
    if (cleanupBell) {
      cleanupBell();
      cleanupBell = null;
    }
    if (headerElement) {
      if (headerElement.parentNode) {
        headerElement.parentNode.removeChild(headerElement);
      }
    }
    if (unsubscribeFromAuthSessionChanges) {
      unsubscribeFromAuthSessionChanges();
    }
    headerElement = null;
    onAuthSessionChanged = null;
    unsubscribeFromAuthSessionChanges = null;
    storedAppState = null;
    return Promise.resolve();
  }

  return { bootstrap, mount, unmount };
}

/**
 * Creates the Single-SPA lifecycle for the social footer.
 *
 * @returns {{ bootstrap: () => Promise<void>, mount: (mountProps: object) => Promise<void>, unmount: () => Promise<void> }} Single-SPA application lifecycle.
 */
function createFooterApp() {
  let footerElement = null;

  function bootstrap() {
    return Promise.resolve();
  }

  function mount(mountProps) {
    const { domElement } = mountProps;
    footerElement = document.createElement("vue-footer-mfe");
    footerElement.setAttribute(
      "message",
      "© 2026 Benchmark Micro Frontend Environment - Social Channel.",
    );
    domElement.appendChild(footerElement);
    return Promise.resolve();
  }

  function unmount() {
    if (footerElement && footerElement.parentNode) {
      footerElement.parentNode.removeChild(footerElement);
    }
    footerElement = null;
    return Promise.resolve();
  }

  return { bootstrap, mount, unmount };
}

export { createHeaderApp, createFooterApp };
