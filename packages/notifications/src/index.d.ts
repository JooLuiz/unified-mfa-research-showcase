export const NOTIFICATIONS_TOPIC: string;
export const NOTIFICATION_REQUESTED_EVENT: string;

export interface NotificationPayload {
  type: "success" | "error";
  title: string;
  message: string;
  durationMs?: number;
}

export interface NotificationTransportMessage {
  topic: string;
  event: string;
  payload: NotificationPayload;
  scope?: string;
}

export interface NotificationTransport {
  publish(message: NotificationTransportMessage): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload: NotificationPayload }) => void,
  ): () => void;
}

export interface NotificationAdapter {
  notify(notification: NotificationPayload): void;
  subscribeToNotifications(listener: (notification: NotificationPayload) => void): () => void;
}

export function createNotificationPayload(notification: NotificationPayload): NotificationPayload;
export function createNotificationAdapter(transport: NotificationTransport): NotificationAdapter;
export function mountNotificationCenter(
  containerElement: HTMLElement,
  notificationBus: Pick<NotificationAdapter, "subscribeToNotifications">,
): () => void;
