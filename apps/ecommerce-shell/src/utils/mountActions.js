import { getCartTotalValue, getCartItemCount } from "./cartActions";
import { isAuthenticated } from "./authActions";
import { navigate } from "./navigate";

function mountHeaderAndFooter(appState, layoutMounts) {
  const headerElement = document.createElement("react-header-mfe");
  headerElement.state = {
    appType: "ecommerce",
    totalPrice: getCartTotalValue(appState),
    itemCount: getCartItemCount(appState),
    isAuthenticated: isAuthenticated(appState),
    currentUserName:
      appState.currentUser?.fullName || appState.currentUser?.username || "",
  };
  headerElement.addEventListener("host:navigate", (event) => {
    navigate(event.detail.path);
  });
  headerElement.addEventListener("host:logout", () => {
    window.dispatchEvent(new CustomEvent("auth:logout-request"));
  });
  layoutMounts.headerMount.appendChild(headerElement);

  const footerElement = document.createElement("vue-footer-mfe");
  footerElement.setAttribute(
    "message",
    "© 2026 Benchmark Micro Frontend Environment. All rights reserved.",
  );
  layoutMounts.footerMount.appendChild(footerElement);
}

export { mountHeaderAndFooter };
