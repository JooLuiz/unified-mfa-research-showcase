import {
  publishLogoutRequested,
  subscribeToAuthSessionChanges,
  subscribeToHeaderEvents,
} from "../events/eventBus";
import { isAuthenticated } from "./authActions";
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

function createHeaderApp() {
  let headerElement = null;
  let unsubscribeFromHeaderEvents = null;
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

    unsubscribeFromHeaderEvents = subscribeToHeaderEvents(headerElement, {
      onNavigate: (event) => {
        const targetPath = event?.detail?.path;
        if (typeof targetPath === "string") {
          navigate(targetPath);
        }
      },
      onLogout: () => {
        publishLogoutRequested();
      },
    });
    unsubscribeFromAuthSessionChanges = subscribeToAuthSessionChanges(() => {
      if (headerElement && storedAppState) {
        headerElement.state = buildHeaderState(storedAppState);
      }
    });

    domElement.appendChild(headerElement);
    return Promise.resolve();
  }

  function unmount() {
    if (unsubscribeFromHeaderEvents) {
      unsubscribeFromHeaderEvents();
    }
    if (unsubscribeFromAuthSessionChanges) {
      unsubscribeFromAuthSessionChanges();
    }
    if (headerElement && headerElement.parentNode) {
      headerElement.parentNode.removeChild(headerElement);
    }
    headerElement = null;
    unsubscribeFromHeaderEvents = null;
    unsubscribeFromAuthSessionChanges = null;
    storedAppState = null;
    return Promise.resolve();
  }

  return { bootstrap, mount, unmount };
}

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
