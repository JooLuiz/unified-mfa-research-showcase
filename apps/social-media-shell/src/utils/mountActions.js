/**
 * Mounts social shell header and footer Single-SPA applications.
 * Role: Adapts the shared header/footer MFEs to the social shell's auth and navigation events.
 * Not in this file: Authentication state persistence, mesh configuration, or page routing.
 * Key dependencies: src/events/eventBus.js; global layout custom elements.
 * See also: src/main.js.
 */

import { isAuthenticated } from "./authActions";
import { subscribeToAuthSessionChanges } from "../events/eventBus";

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

  function mount(mountProps) {
    const { appState, domElement } = mountProps;
    storedAppState = appState;

    headerElement = document.createElement("react-header-mfe");
    headerElement.state = buildHeaderState(appState);

    onAuthSessionChanged = () => {
      if (headerElement && storedAppState) {
        headerElement.state = buildHeaderState(storedAppState);
      }
    };

    unsubscribeFromAuthSessionChanges =
      subscribeToAuthSessionChanges(onAuthSessionChanged);

    domElement.appendChild(headerElement);
    return Promise.resolve();
  }

  function unmount() {
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
