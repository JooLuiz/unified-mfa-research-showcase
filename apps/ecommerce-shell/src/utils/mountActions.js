import { getCartDiscountedTotal, getCartItemCount } from "./cartActions";
import { isAuthenticated } from "./authActions";

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
