/**
 * Tab-scoped notification inbox live stream and state singleton.
 * Role: Opens one EventSource per signed-in tab scoped to (userId, shell), fetches the list,
 *   reconciles changed items, emits only newly inserted rows, and handles read commands.
 */

import { NOTIFICATION_INBOX_CHANGED_EVENT_NAME } from "./contracts.js";
import {
  fetchNotificationInbox,
  markNotificationAsRead as apiMarkNotificationAsRead,
  markAllNotificationsAsRead as apiMarkAllNotificationsAsRead,
} from "./notificationInboxApi.js";

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30_000;

class NotificationInboxManager {
  constructor() {
    this.listeners = new Set();
    this.newItemListeners = new Set();
    this.notifications = [];
    this.activeEventSource = null;
    this.reconnectTimer = null;
    this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    this.isStarting = false;
    this.apiBaseUrl = "";
    this.authToken = "";
    this.shell = "";
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

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  closeEventSource() {
    if (this.activeEventSource) {
      this.activeEventSource.close();
      this.activeEventSource = null;
    }
  }

  scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      if (!this.authToken || !this.shell) {
        return;
      }
      this.reconnectDelayMs = Math.min(
        this.reconnectDelayMs * 2,
        MAX_RECONNECT_DELAY_MS,
      );
      void this.connectStream();
    }, this.reconnectDelayMs);
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
    const index = this.notifications.findIndex(
      (item) => item.id === changedNotification.id,
    );
    const isNewNotification = index < 0;
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

  connectStream() {
    if (!this.authToken || !this.shell || !this.apiBaseUrl) {
      return;
    }
    this.closeEventSource();

    const streamUrl = `${this.apiBaseUrl}/notifications/stream?shell=${encodeURIComponent(
      this.shell,
    )}&token=${encodeURIComponent(this.authToken)}`;

    const eventSource = new EventSource(streamUrl);
    eventSource.addEventListener(
      NOTIFICATION_INBOX_CHANGED_EVENT_NAME,
      (event) => {
        try {
          const changedNotification = JSON.parse(event.data);
          this.handleInboxChanged(changedNotification);
        } catch (error) {
          console.warn("connectStream - parse error");
          console.warn(error);
        }
      },
    );

    eventSource.onerror = () => {
      this.closeEventSource();
      this.scheduleReconnect();
    };

    this.activeEventSource = eventSource;
    this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
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

    try {
      const items = await fetchNotificationInbox({ apiBaseUrl, authToken, shell });
      this.notifications = items;
      this.notifyListeners();
      this.connectStream();
    } catch (error) {
      console.warn("NotificationInboxManager start - error");
      console.warn(error);
      this.scheduleReconnect();
    } finally {
      this.isStarting = false;
    }
  }

  stop() {
    this.clearReconnectTimer();
    this.closeEventSource();
    this.authToken = "";
    this.shell = "";
    this.notifications = [];
    this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
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
    if (!notificationId) {
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
      const updated = await apiMarkNotificationAsRead({
        apiBaseUrl: this.apiBaseUrl,
        authToken: this.authToken,
        notificationId,
      });
      this.handleInboxChanged(updated);
    } catch (error) {
      console.warn("NotificationInboxManager markAsRead - error");
      console.warn(error);
      if (this.authToken && this.shell) {
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
    }
  }

  async markAllAsRead() {
    if (!this.authToken || !this.shell) {
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
      const items = await apiMarkAllNotificationsAsRead({
        apiBaseUrl: this.apiBaseUrl,
        authToken: this.authToken,
        shell: this.shell,
      });
      this.notifications = items;
      this.notifyListeners();
    } catch (error) {
      console.warn("NotificationInboxManager markAllAsRead - error");
      console.warn(error);
      if (this.authToken && this.shell) {
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
    }
  }
}

const inboxManagerInstance = new NotificationInboxManager();

export function startNotificationInboxLiveEvents(input) {
  return inboxManagerInstance.start(input);
}

export function stopNotificationInboxLiveEvents() {
  inboxManagerInstance.stop();
}

export function subscribeToNotificationInbox(listener) {
  return inboxManagerInstance.subscribe(listener);
}

export function getNotificationInboxState() {
  return inboxManagerInstance.getState();
}

export function markNotificationRead(notificationId) {
  return inboxManagerInstance.markAsRead(notificationId);
}

/** Subscribes to rows the live stream inserts. The initial fetch does not call this listener. */
export function subscribeToNewInboxNotifications(listener) {
  return inboxManagerInstance.subscribeToNewItems(listener);
}

/** Marks every unread row in the active shell as read. */
export function markAllNotificationsRead() {
  return inboxManagerInstance.markAllAsRead();
}
