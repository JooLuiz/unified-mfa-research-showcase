export const NOTIFICATION_TOPIC: string;
export const NOTIFICATION_RAISED_EVENT: string;

export interface ShellNotification {
  type: "success" | "error";
  title: string;
  message: string;
  durationMs?: number;
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

export interface MeshNotificationAdapter {
  publishNotification(
    notification: ShellNotification,
    options?: { scope?: "local" | "distributed" },
  ): void;
}

export interface NotificationCenterHandle {
  unmount(): void;
  ensureNotificationDisplayListeners(): void;
  resetNotificationDisplayListeners(): void;
}

export function createMeshNotificationAdapter(input: {
  mesh: Pick<NotificationMeshClient, "publish">;
}): MeshNotificationAdapter;

export function mountNotificationCenter(
  containerElement: HTMLElement,
  mesh: NotificationMeshClient,
): NotificationCenterHandle;
