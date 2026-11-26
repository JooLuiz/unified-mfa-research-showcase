/**
 * Boots the admin shell, its page routing, and local integration services.
 * Role: Owns admin host lifecycle, mesh session wiring, and shell event handlers.
 * Not in this file: Route decisions and painting (src/pages/pageRegistry.js, src/pages/pageRenderer.js),
 *   the session state machine (@shared/shell-events), API request details, or toast rendering.
 * Key dependencies: @shared/shell-events; src/events/eventBus.js; notification and remote-module adapters.
 * See also: src/utils/loadRemoteModules.js; src/notifications/notificationCenter.js.
 */

import "./styles.css";
import { createAuthSessionLifecycle, createRenderedSessionMarker } from "@shared/shell-events";
import {
  readStoredAuth,
  clearAuthSession,
  isAdminAuthenticated,
  refreshCurrentUserFromApi,
  fetchStoredConnectionTicket,
} from "./utils/authActions";

import loadRemoteModules from "./utils/loadRemoteModules";
import {
  mountNotificationCenter,
  ensureNotificationDisplayListeners,
  resetNotificationDisplayListeners,
} from "./notifications/notificationCenter";
import {
  bindShellTransport,
  createShellSessionChannel,
  ensureAccountIntentListeners,
  ensureShellEventListeners,
  publishLogoutRequested,
  resetAccountIntentListeners,
  resetShellEventListeners,
  shellTransport,
} from "./events/eventBus";
import { updateHeaderState } from "./utils/mountActions";
import { navigate } from "./utils/navigate";
import { publishNotification } from "./notifications/notificationAdapter";
import {
  startAdminOrderStatusStream,
  stopAdminOrderStatusStream,
} from "@shared/order-status-events";
import {
  startSessionLiveEvents,
  stopSessionLiveEvents,
  subscribeToSessionRevoked,
} from "@shared/session-events";
import {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNewInboxNotifications,
} from "@shared/notification-inbox-events";
import {
  startAdminLiveEvents,
  stopAdminLiveEvents,
} from "./events/adminLiveEvents";
import { persistAccountUpdate } from "./commands/accountCommands";
import { createPageRenderer } from "./pages/pageRenderer";

const appState = {
  authToken: null,
  currentUser: null,
};

bindShellTransport(() => appState.authToken);

const renderedSession = createRenderedSessionMarker(appState);
const pageRenderer = createPageRenderer({
  appState,
  loadModules: () => loadRemoteModules,
  marker: renderedSession,
});

subscribeToNewInboxNotifications((notification) => {
  publishNotification({
    type: "success",
    title: notification.title,
    message: notification.message,
    link: notification.link,
    notificationId: notification.id,
  });
});

/**
 * Stops the admin activity, order-status, session, and inbox subscriptions.
 *
 * @returns {void}
 * @sideEffects Unsubscribes the admin live mesh listeners.
 */
function stopAdminLiveSubscriptions() {
  stopAdminLiveEvents();
  stopAdminOrderStatusStream();
  stopSessionLiveEvents();
  stopNotificationInboxLiveEvents();
}

/**
 * Starts admin live-event subscriptions when the current user is an admin, and stops them otherwise.
 *
 * @returns {void}
 * @sideEffects Subscribes or unsubscribes the admin activity mesh listeners.
 */
function syncAdminLiveEventsWithSession() {
  if (!isAdminAuthenticated(appState)) {
    stopAdminLiveSubscriptions();
    return;
  }
  void startAdminLiveEvents(shellTransport);
  void startAdminOrderStatusStream(shellTransport);
  void startSessionLiveEvents(shellTransport);
  void startNotificationInboxLiveEvents(shellTransport, { shell: "admin" });
}

const accountIntentHandlers = {
  onProfileSaveRequested: (profilePayload) => {
    void persistAccountUpdate(shellTransport, appState, profilePayload);
  },
  onAddressSaveRequested: (addressPayload) => {
    void persistAccountUpdate(shellTransport, appState, { address: addressPayload });
  },
};

const shellEventHandlers = {
  onRenderRequested: () => {
    void pageRenderer.render();
  },
  onPathRequested: ({ path }) => {
    navigate(path);
  },
  onAuthSessionChanged: () => {
    const wasAuthenticated = Boolean(appState.authToken);
    readStoredAuth(appState);
    const isNowAuthenticated = Boolean(appState.authToken);
    authSession.sync();
    if (!wasAuthenticated && isNowAuthenticated) {
      const welcomeName =
        appState.currentUser?.fullName ||
        appState.currentUser?.username ||
        "there";
      publishNotification({
        type: "success",
        title: "Signed in",
        message: `Welcome back, ${welcomeName}.`,
      });
    }
    // A same user who is still an admin is a profile refresh. A role change
    // falls through so the renderer runs the admin gate again.
    if (renderedSession.isSameSignedInUser() && isAdminAuthenticated(appState)) {
      updateHeaderState(appState, pageRenderer.getHeaderElement());
      return;
    }
    void pageRenderer.render();
  },
  onLogoutRequested: () => {
    clearAuthSession(appState);
    navigate("/login");
  },
};

const authSession = createAuthSessionLifecycle(
  createShellSessionChannel({ getConnectionTicket: fetchStoredConnectionTicket }),
  {
    isAuthenticated: () => Boolean(appState.authToken),
    attachListeners: () => {
      ensureNotificationDisplayListeners();
      ensureShellEventListeners(shellEventHandlers);
      ensureAccountIntentListeners(accountIntentHandlers);
    },
    detachListeners: () => {
      resetNotificationDisplayListeners();
      resetShellEventListeners();
      resetAccountIntentListeners();
    },
    startLiveEvents: syncAdminLiveEventsWithSession,
    stopLiveEvents: stopAdminLiveSubscriptions,
  },
);

window.addEventListener("popstate", () => {
  void pageRenderer.render();
});

subscribeToSessionRevoked(() => {
  if (!appState.authToken) {
    return;
  }
  // Logout first. Downgrade resets the toast listener and clears rendered toasts,
  // so the session-ended notice is published on the local mesh that downgrade opens.
  publishLogoutRequested();
  publishNotification({
    type: "error",
    title: "Session ended",
    message: "Your session ended on another device.",
  });
});

async function bootstrap() {
  readStoredAuth(appState);
  authSession.start();
  // The notification subscribe has to follow configureMesh. The first use
  // initializes EventMesh and a later configureMesh throws.
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }
  if (appState.authToken) {
    void refreshCurrentUserFromApi(appState);
  }
  await pageRenderer.render();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
