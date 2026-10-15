import {
  publishLogoutRequested,
  subscribeToHeaderEvents,
} from "../events/eventBus";
import { isAuthenticated } from "./authActions";
import { navigate } from "./navigate";

function mountHeaderAndFooter(appState, layoutMounts, modules, activeCleanupFunctions) {
  const headerElement = document.createElement("react-header-mfe");
  headerElement.state = {
    appType: "admin",
    totalPrice: 0,
    itemCount: 0,
    isAuthenticated: isAuthenticated(appState),
    currentUserName:
      appState.currentUser?.fullName || appState.currentUser?.username || "",
  };
  subscribeToHeaderEvents(headerElement, {
    onNavigate: (event) => {
      navigate(event.detail.path);
    },
    onLogout: () => {
      publishLogoutRequested();
    },
  });
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
}

export { mountHeaderAndFooter };
