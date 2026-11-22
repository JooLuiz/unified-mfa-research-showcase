/**
 * Tab-scoped notification inbox state.
 * Role: Loads the inbox, announces notification-inbox/watching for the shell, applies live row changes, and sends mark-read commands.
 * Not in this file: Toast rendering or the stream URL.
 * Key dependencies: src/notificationInboxApi.js; src/contracts.js. The caller supplies the transport.
 * See also: apps/ecommerce-shell/src/main.js.
 */

import { NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_WATCHING_EVENT } from "./contracts.js";
import {
  fetchNotificationInbox,
  markNotificationAsRead as apiMarkNotificationAsRead,
  markAllNotificationsAsRead as apiMarkAllNotificationsAsRead,
} from "./notificationInboxApi.js";

const INBOX_CHANGED_EVENT = "changed";
const RESTART_DELAY_MS = 2000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

class NotificationInboxManager {
  constructor() {
    this.listeners = new Set();
    this.newItemListeners = new Set();
    this.notifications = [];
    this.transport = null;
    this.shell = "";
    this.unsubscribeFromChanges = null;
    this.restartTimer = null;
    this.isStarting = false;
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
    const isNewNotification = index === -1;
    if (isNewNotification) {
      this.notifications = [changedNotification, ...this.notifications];
    } else {
      this.notifications[index] = changedNotification;
    }
    this.notifyListeners();
    if (isNewNotification) {
      this.notifyNewItemListeners(changedNotification);
    }
  }

  clearRestartTimer() {
    if (this.restartTimer) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  closeSubscription() {
    if (this.unsubscribeFromChanges) {
      this.unsubscribeFromChanges();
      this.unsubscribeFromChanges = null;
    }
  }

  scheduleRestart() {
    this.clearRestartTimer();
    this.restartTimer = window.setTimeout(() => {
      if (this.transport && this.shell) {
        void this.start(this.transport, { shell: this.shell });
      }
    }, RESTART_DELAY_MS);
  }

  /**
   * @param {{ request: Function, subscribe: Function }} transport
   * @param {{ shell: string }} input
   * @returns {Promise<void>}
   * @sideEffects Replaces inbox state and subscribes to notification-inbox/changed.
   */
  async start(transport, { shell }) {
    this.transport = transport;
    this.shell = shell;
    if (!shell) {
      this.stop();
      return;
    }
    if (this.isStarting) {
      return;
    }
    this.isStarting = true;
    this.closeSubscription();
    try {
      const items = await fetchNotificationInbox(transport, { shell });
      this.notifications = items;
      this.notifyListeners();
      this.unsubscribeFromChanges = transport.subscribe(
        NOTIFICATION_INBOX_TOPIC,
        INBOX_CHANGED_EVENT,
        (message) => {
          this.handleInboxChanged(message.payload);
        },
      );
      this.publishInboxWatching(transport, shell);
    } catch (error) {
      console.warn("NotificationInboxManager start - error");
      console.warn(error);
      this.scheduleRestart();
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Registers this tab for inbox pushes for one shell.
   *
   * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface. A subscribe-only fake is ignored.
   * @param {string} shell - Shell name the gateway registry requires.
   * @returns {void}
   * @sideEffects Publishes notification-inbox/watching with payload.shell. A connect timeout is swallowed.
   */
  publishInboxWatching(transport, shell) {
    if (typeof transport.publish !== "function" || typeof transport.whenConnected !== "function") {
      return;
    }
    try {
      const connected = transport.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
      if (connected && typeof connected.catch === "function") {
        connected.catch(() => {
          // The gateway drops inbox changes for a client that never announced its shell.
        });
      }
    } catch {
      return;
    }
    transport.publish({
      topic: NOTIFICATION_INBOX_TOPIC,
      event: NOTIFICATION_INBOX_WATCHING_EVENT,
      payload: { shell },
      scope: "distributed",
    });
  }

  stop() {
    this.clearRestartTimer();
    this.closeSubscription();
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
    if (!notificationId || !this.transport) {
      return;
    }
    const item = this.notifications.find((target) => target.id === notificationId);
    if (item && item.read) {
      return;
    }
    if (item) {
      item.read = true;
      this.notifyListeners();
    }
    try {
      const updated = await apiMarkNotificationAsRead(this.transport, { notificationId });
      this.handleInboxChanged(updated);
    } catch (error) {
      console.warn("NotificationInboxManager markAsRead - error");
      console.warn(error);
      await this.refetchInbox();
    }
  }

  async markAllAsRead() {
    if (!this.transport || !this.shell) {
      return;
    }
    const hasUnread = this.notifications.some((item) => !item.read);
    if (!hasUnread) {
      return;
    }
    this.notifications = this.notifications.map((item) =>
      item.read ? item : { ...item, read: true },
    );
    this.notifyListeners();
    try {
      const items = await apiMarkAllNotificationsAsRead(this.transport, { shell: this.shell });
      this.notifications = items;
      this.notifyListeners();
    } catch (error) {
      console.warn("NotificationInboxManager markAllAsRead - error");
      console.warn(error);
      await this.refetchInbox();
    }
  }

  async refetchInbox() {
    if (!this.transport || !this.shell) {
      return;
    }
    try {
      const items = await fetchNotificationInbox(this.transport, { shell: this.shell });
      this.notifications = items;
      this.notifyListeners();
    } catch (error) {
      console.warn("NotificationInboxManager refetchInbox - error");
      console.warn(error);
    }
  }
}

const inboxManagerInstance = new NotificationInboxManager();

/**
 * Loads the inbox for one shell and subscribes to later changes.
 *
 * @param {{ request: Function, subscribe: Function }} transport - Event interface.
 * @param {{ shell: string }} input - Shell name.
 * @returns {Promise<void>}
 * @sideEffects Replaces the singleton inbox and opens its live subscription.
 */
export function startNotificationInboxLiveEvents(transport, input) {
  return inboxManagerInstance.start(transport, input);
}

/**
 * Clears the inbox and closes its subscription.
 *
 * @returns {void}
 * @sideEffects Notifies listeners with an empty list.
 */
export function stopNotificationInboxLiveEvents() {
  inboxManagerInstance.stop();
}

/**
 * @param {(notifications: object[]) => void} listener
 * @returns {() => void}
 * @sideEffects Calls the listener immediately with the current rows.
 */
export function subscribeToNotificationInbox(listener) {
  return inboxManagerInstance.subscribe(listener);
}

/**
 * @returns {object[]} Current inbox rows.
 */
export function getNotificationInboxState() {
  return inboxManagerInstance.getState();
}

/**
 * @param {string} notificationId
 * @returns {Promise<void>}
 * @sideEffects Marks the row read locally, then confirms with the server.
 */
export function markNotificationRead(notificationId) {
  return inboxManagerInstance.markAsRead(notificationId);
}

/**
 * Subscribes to rows the live stream inserts. The initial fetch does not call this listener.
 *
 * @param {(notification: object) => void} listener
 * @returns {() => void}
 */
export function subscribeToNewInboxNotifications(listener) {
  return inboxManagerInstance.subscribeToNewItems(listener);
}

/**
 * Marks every unread row in the active shell as read.
 *
 * @returns {Promise<void>}
 * @sideEffects Updates local rows, then confirms with the server.
 */
export function markAllNotificationsRead() {
  return inboxManagerInstance.markAllAsRead();
}
