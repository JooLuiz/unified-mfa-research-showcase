import "./styles.css";

import { createAuthSessionLifecycle, createRenderedSessionMarker } from "@shared/shell-events";
import {
  readStoredAuth,
  clearAuthSession,
  isAdminAuthenticated,
  refreshCurrentUserFromApi,
} from "./utils/authActions";

import loadRemoteModules from "./utils/loadRemoteModules";
import {
  bindShellTransport,
  createShellSessionChannel,
  ensureAccountIntentListeners,
  publishLogoutRequested,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} from "./events/eventBus";
import { mountNotificationCenter } from "./notifications/notificationCenter";
import { updateHeaderState } from "./utils/mountActions";
import { navigate } from "./utils/navigate";
import { publishNotification } from "./notifications/notificationAdapter";
import {
  startAdminOrderStatusStream,
  stopAdminOrderStatusStream,
} from "@shared/order-status-events";
import {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNewInboxNotifications,
} from "@shared/notification-inbox-events";
import { subscribeToSessionRevoked } from "@shared/session-events";
import {
  startAdminLiveEvents,
  stopAdminLiveEvents,
} from "./events/adminLiveEvents";
import { createAccountIntentHandlers } from "./intents/accountIntentHandlers";
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
 * Stops the admin live-notifications stream, order-status stream, and inbox.
 *
 * @returns {void}
 * @sideEffects Closes the admin live subscriptions.
 */
function stopAdminLiveSubscriptions() {
  stopAdminLiveEvents();
  stopAdminOrderStatusStream();
  stopNotificationInboxLiveEvents();
}

/**
 * Starts the admin live subscriptions when the current user is an admin, and stops them otherwise.
 *
 * @returns {void}
 * @sideEffects Opens or closes the admin live subscriptions via src/events/adminLiveEvents.js.
 */
function syncAdminLiveEventsWithSession() {
  if (!isAdminAuthenticated(appState)) {
    stopAdminLiveSubscriptions();
    return;
  }
  void startAdminLiveEvents(shellTransport);
  void startAdminOrderStatusStream(shellTransport);
  void startNotificationInboxLiveEvents(shellTransport, { shell: "admin" });
}

const accountIntentHandlers = createAccountIntentHandlers(appState);

const authSession = createAuthSessionLifecycle(createShellSessionChannel(), {
  isAuthenticated: () => Boolean(appState.authToken),
  // Window listeners last for the tab, so they are attached once and never detached.
  attachListeners: () => {
    ensureAccountIntentListeners(accountIntentHandlers);
  },
  startLiveEvents: syncAdminLiveEventsWithSession,
  stopLiveEvents: stopAdminLiveSubscriptions,
});

subscribeToRenderRequests(() => {
  pageRenderer.render();
});

window.addEventListener("popstate", () => {
  pageRenderer.render();
});

subscribeToAuthSessionChanges(() => {
  // setAuthSession and refreshCurrentUserFromApi write appState before this event.
  // A matching user id that is still an admin is a profile refresh: remounting
  // would replace the account page's action buttons while a click is in flight.
  // A role change for that same id must still remount so the admin gate runs again.
  if (renderedSession.isSameSignedInUser() && isAdminAuthenticated(appState)) {
    updateHeaderState(appState, pageRenderer.getHeaderElement());
    return;
  }
  authSession.sync();
  pageRenderer.render();
});

subscribeToLogoutRequests(() => {
  clearAuthSession(appState);
  navigate("/login");
});

subscribeToSessionRevoked(() => {
  if (!appState.authToken) {
    return;
  }
  publishNotification({
    type: "error",
    title: "Session ended",
    message: "Your session ended on another device.",
  });
  publishLogoutRequested();
});

async function bootstrap() {
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }

  readStoredAuth(appState);
  if (appState.authToken) {
    void refreshCurrentUserFromApi(appState);
  }
  authSession.start();
  await pageRenderer.render();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
