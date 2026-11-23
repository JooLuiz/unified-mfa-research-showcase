export const NOTIFICATION_TOPIC: string;
export const NOTIFICATION_RAISED_EVENT: string;

export interface ShellNotification {
  type: "success" | "error";
  title: string;
  message: string;
  durationMs?: number;
  link?: string;
  notificationId?: string;
}

export function isValidNotificationPayload(notificationPayload: unknown): notificationPayload is ShellNotification;

export interface NotificationMeshClient {
  publish(input: {
    topic: string;
    event: string;
    payload: ShellNotification;
    scope: "local" | "distributed";
  }): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ): () => void;
}

export interface NotificationAdapter {
  notify(notification: ShellNotification): void;
  subscribeToNotifications(listener: (notification: ShellNotification) => void): () => void;
}

export interface NotificationCenterHandle {
  unmount(): void;
  ensureNotificationDisplayListeners(): void;
  resetNotificationDisplayListeners(): void;
}

export function createNotificationAdapter(transport: NotificationMeshClient): NotificationAdapter;

export function mountNotificationCenter(
  containerElement: HTMLElement,
  mesh: NotificationMeshClient,
  options?: { onOpenLink?: (notification: ShellNotification) => void },
): NotificationCenterHandle;
