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
  let onHostNavigate = null;
  let onHostLogout = null;
  let onAuthChanged = null;
  let storedAppState = null;

  function bootstrap() {
    return Promise.resolve();
  }

  function mount(mountProps) {
    const { appState, domElement } = mountProps;
    storedAppState = appState;

    headerElement = document.createElement("react-header-mfe");
    headerElement.state = buildHeaderState(appState);

    onHostNavigate = (event) => {
      const targetPath = event?.detail?.path;
      if (typeof targetPath === "string") {
        navigate(targetPath);
      }
    };
    onHostLogout = () => {
      window.dispatchEvent(new CustomEvent("auth:logout-request"));
    };
    onAuthChanged = () => {
      if (headerElement && storedAppState) {
        headerElement.state = buildHeaderState(storedAppState);
      }
    };

    headerElement.addEventListener("host:navigate", onHostNavigate);
    headerElement.addEventListener("host:logout", onHostLogout);
    window.addEventListener("auth:changed", onAuthChanged);

    domElement.appendChild(headerElement);
    return Promise.resolve();
  }

  function unmount() {
    if (headerElement) {
      if (onHostNavigate) {
        headerElement.removeEventListener("host:navigate", onHostNavigate);
      }
      if (onHostLogout) {
        headerElement.removeEventListener("host:logout", onHostLogout);
      }
      if (headerElement.parentNode) {
        headerElement.parentNode.removeChild(headerElement);
      }
    }
    if (onAuthChanged) {
      window.removeEventListener("auth:changed", onAuthChanged);
    }
    headerElement = null;
    onHostNavigate = null;
    onHostLogout = null;
    onAuthChanged = null;
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
