/**
 * Tab-scoped notification inbox state.
 * Role: Fetches the list, keeps it in sync with mesh changed events, and sends mark-read commands.
 * Not in this file: Mesh subscribe/publish details (src/notificationInboxMeshSession.js) or toast rendering.
 * Key dependencies: event-mesh/mesh; src/notificationInboxApi.js.
 * See also: apps/mock-data-service/src/event-mesh/notificationInboxHandler.js.
 *   On main this module opens an EventSource; this branch uses the gateway.
 *   Call start again after mesh.close(), because that drops these subscriptions.
 */

import mesh from "event-mesh/mesh";
import { fetchNotificationInbox } from "./notificationInboxApi.js";
import {
  MESH_CONNECT_TIMEOUT_MS,
  createNotificationInboxMeshSession,
} from "./notificationInboxMeshSession.js";

/**
 * Holds one tab's inbox list and delegates the mesh session.
 */
class NotificationInboxManager {
  constructor() {
    this.listeners = new Set();
    this.newItemListeners = new Set();
    this.notifications = [];
    this.sessionGeneration = 0;
    this.isStarting = false;
    this.apiBaseUrl = "";
    this.authToken = "";
    this.shell = "";
    this.meshSession = createNotificationInboxMeshSession({
      onChanged: (notification) => this.handleInboxChanged(notification),
    });
  }

  notifyListeners() {
    const snapshot = [...this.notifications];
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn("NotificationInboxManager listener error");
        console.warn(error);
      }
    });
  }

  notifyNewItemListeners(notification) {
    this.newItemListeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (error) {
        console.warn("NotificationInboxManager new item listener error");
        console.warn(error);
      }
    });
  }

  handleInboxChanged(changedNotification) {
    if (!changedNotification || !changedNotification.id) {
      return;
    }
    const index = this.notifications.findIndex((item) => item.id === changedNotification.id);
    const isNewNotification = index < 0;
    if (isNewNotification) {
      this.notifications = [changedNotification, ...this.notifications];
    } else {
      const nextNotifications = [...this.notifications];
      nextNotifications[index] = changedNotification;
      this.notifications = nextNotifications;
    }
    this.notifyListeners();
    if (isNewNotification) {
      this.notifyNewItemListeners(changedNotification);
    }
  }

  async refetch() {
    if (!this.authToken || !this.shell) {
      return;
    }
    const items = await fetchNotificationInbox({
      apiBaseUrl: this.apiBaseUrl,
      authToken: this.authToken,
      shell: this.shell,
    }).catch(() => null);
    if (items) {
      this.notifications = items;
      this.notifyListeners();
    }
  }

  async start({ apiBaseUrl, authToken, shell }) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
    this.shell = shell;
    if (!authToken || !shell) {
      this.stop();
      return;
    }
    if (this.isStarting) {
      return;
    }
    this.isStarting = true;
    const generation = ++this.sessionGeneration;
    try {
      const items = await fetchNotificationInbox({ apiBaseUrl, authToken, shell });
      if (generation !== this.sessionGeneration) {
        return;
      }
      this.notifications = items;
      this.notifyListeners();
      await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
      if (generation !== this.sessionGeneration) {
        return;
      }
      this.meshSession.start(shell);
    } catch (error) {
      console.warn("NotificationInboxManager start - error");
      console.warn(error);
    } finally {
      if (generation === this.sessionGeneration) {
        this.isStarting = false;
      }
    }
  }

  stop() {
    this.sessionGeneration += 1;
    this.isStarting = false;
    this.meshSession.stop();
    this.authToken = "";
    this.shell = "";
    this.notifications = [];
    this.notifyListeners();
  }

  getState() {
    return [...this.notifications];
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener([...this.notifications]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeToNewItems(listener) {
    this.newItemListeners.add(listener);
    return () => {
      this.newItemListeners.delete(listener);
    };
  }

  async markAsRead(notificationId) {
    if (!notificationId || !this.authToken) {
      return;
    }
    const existingItem = this.notifications.find((item) => item.id === notificationId);
    if (existingItem?.read) {
      return;
    }
    if (existingItem) {
      this.handleInboxChanged({ ...existingItem, read: true });
    }
    try {
      const outcome = await this.meshSession.sendMarkRead(notificationId);
      if (outcome.ok && outcome.notification) {
        this.handleInboxChanged(outcome.notification);
        return;
      }
      await this.refetch();
    } catch (error) {
      console.warn("NotificationInboxManager markAsRead - error");
      console.warn(error);
      await this.refetch();
    }
  }

  async markAllAsRead() {
    if (!this.authToken || !this.shell) {
      return;
    }
    if (!this.notifications.some((item) => !item.read)) {
      return;
    }
    this.notifications = this.notifications.map((item) => (item.read ? item : { ...item, read: true }));
    this.notifyListeners();
    try {
      const outcome = await this.meshSession.sendMarkAllRead(this.shell);
      if (outcome.ok) {
        this.notifications = outcome.items;
        this.notifyListeners();
        return;
      }
      await this.refetch();
    } catch (error) {
      console.warn("NotificationInboxManager markAllAsRead - error");
      console.warn(error);
      await this.refetch();
    }
  }
}

const inboxManagerInstance = new NotificationInboxManager();

/**
 * Loads the shell inbox and opens the mesh watching session.
 *
 * @param {{ apiBaseUrl: string, authToken: string, shell: string }} input - API base, bearer token, and shell.
 * @returns {Promise<void>}
 * @sideEffects Fetches GET /notifications and subscribes to notification-inbox/changed.
 */
export function startNotificationInboxLiveEvents(input) {
  return inboxManagerInstance.start(input);
}

/** Stops the mesh session and clears the in-memory list. */
export function stopNotificationInboxLiveEvents() {
  inboxManagerInstance.stop();
}

/**
 * Subscribes to the full inbox list, including the current snapshot.
 *
 * @param {(items: object[]) => void} listener - Called with the current rows.
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToNotificationInbox(listener) {
  return inboxManagerInstance.subscribe(listener);
}

/** @returns {object[]} Current inbox rows. */
export function getNotificationInboxState() {
  return inboxManagerInstance.getState();
}

/**
 * Marks one row read over the gateway.
 *
 * @param {string} notificationId - Inbox row id.
 * @returns {Promise<void>}
 * @sideEffects Publishes notification-inbox/mark-read.
 */
export function markNotificationRead(notificationId) {
  return inboxManagerInstance.markAsRead(notificationId);
}

/**
 * Subscribes to rows the live stream inserts. The initial fetch does not call this listener.
 *
 * @param {(notification: object) => void} listener - Called once per newly inserted row.
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToNewInboxNotifications(listener) {
  return inboxManagerInstance.subscribeToNewItems(listener);
}

/**
 * Marks every unread row in the active shell as read.
 *
 * @returns {Promise<void>}
 * @sideEffects Publishes notification-inbox/mark-all-read.
 */
export function markAllNotificationsRead() {
  return inboxManagerInstance.markAllAsRead();
}
