import {
  publishLogoutRequested,
  subscribeToHeaderEvents,
} from "../events/eventBus";
import { getCartDiscountedTotal, getCartItemCount } from "./cartActions";
import { isAuthenticated } from "./authActions";
import { navigate } from "./navigate";

function buildHeaderState(appState) {
  return {
    appType: "ecommerce",
    totalPrice: getCartDiscountedTotal(appState),
    itemCount: getCartItemCount(appState),
    isAuthenticated: isAuthenticated(appState),
    currentUserName:
      appState.currentUser?.fullName || appState.currentUser?.username || "",
  };
}

function updateHeaderState(appState, headerElement) {
  if (!headerElement) {
    return;
  }
  headerElement.state = buildHeaderState(appState);
}

function mountHeaderAndFooter(appState, layoutMounts) {
  const headerElement = document.createElement("react-header-mfe");
  updateHeaderState(appState, headerElement);
  subscribeToHeaderEvents(headerElement, {
    onNavigate: (event) => {
      navigate(event.detail.path);
    },
    onLogout: () => {
      publishLogoutRequested();
    },
  });
  layoutMounts.headerMount.appendChild(headerElement);

  const footerElement = document.createElement("vue-footer-mfe");
  footerElement.setAttribute(
    "message",
    "© 2026 Benchmark Micro Frontend Environment. All rights reserved.",
  );
  layoutMounts.footerMount.appendChild(footerElement);

  return headerElement;
}

export { mountHeaderAndFooter, updateHeaderState };
