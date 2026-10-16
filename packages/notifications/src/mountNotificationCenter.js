/**
 * Renders and manages a persistent toast queue for a shell.
 * Role: Subscribes to mesh notification events and renders accessible, auto-dismissing toasts.
 * Not in this file: Business outcome decisions, mesh configuration, or route-specific UI.
 * Key dependencies: event-mesh/mesh client; notificationPayload validation helpers.
 * See also: src/notificationPayload.js; src/createMeshNotificationAdapter.js.
 */

import {
  NOTIFICATION_TOPIC,
  NOTIFICATION_RAISED_EVENT,
  isValidNotificationPayload,
} from "./notificationPayload.js";

const DEFAULT_DURATION_MS = 5000;

/**
 * Mounts the notification center in a persistent shell-level container.
 *
 * @param {HTMLElement} containerElement - Element that owns the rendered toast queue.
 * @param {{ subscribe: (topic: string, event: string, callback: (message: object) => void) => void }} mesh - Mesh client for notification display subscription.
 * @param {{ onOpenLink?: (notification: { link?: string, notificationId?: string }) => void }} [options] - Optional click handler for toasts that carry a link. When the toast was raised from a persisted inbox row, `notification.notificationId` is also present so the host can mark it read.
 * @returns {{ unmount: () => void, ensureNotificationDisplayListeners: () => void, resetNotificationDisplayListeners: () => void }} Lifecycle API for toast display and mesh subscription management.
 * @sideEffects Mutates the supplied container; registers mesh listeners when ensure is called.
 */
function mountNotificationCenter(containerElement, mesh, { onOpenLink } = {}) {
  const dismissalTimers = new Set();
  let notificationDisplayListenersStarted = false;

  containerElement.className = "notification-center";
  containerElement.setAttribute("aria-live", "polite");
  containerElement.setAttribute("aria-atomic", "false");

  function dismissNotification(notificationElement, timerId) {
    if (timerId) {
      window.clearTimeout(timerId);
      dismissalTimers.delete(timerId);
    }
    notificationElement.remove();
  }

  function renderNotification(notification) {
    const notificationElement = document.createElement("section");
    notificationElement.className = `notification-toast notification-toast--${notification.type}`;
    notificationElement.setAttribute(
      "role",
      notification.type === "error" ? "alert" : "status",
    );

    const titleElement = document.createElement("strong");
    titleElement.textContent = notification.title;

    const messageElement = document.createElement("p");
    messageElement.textContent = notification.message;

    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "notification-toast-dismiss";
    dismissButton.setAttribute("aria-label", `Dismiss ${notification.title}`);
    dismissButton.textContent = "Dismiss";

    notificationElement.append(titleElement, messageElement, dismissButton);
    containerElement.appendChild(notificationElement);

    const durationMs = notification.durationMs ?? DEFAULT_DURATION_MS;
    const timerId = window.setTimeout(
      () => dismissNotification(notificationElement, timerId),
      durationMs,
    );
    dismissalTimers.add(timerId);
    dismissButton.addEventListener("click", (clickEvent) => {
      clickEvent.stopPropagation();
      dismissNotification(notificationElement, timerId);
    });

    const hasDetailLink = typeof notification.link === "string" && notification.link.length > 0;
    if (hasDetailLink && typeof onOpenLink === "function") {
      notificationElement.classList.add("notification-toast--linked");
      notificationElement.addEventListener("click", () => {
        onOpenLink(notification);
        dismissNotification(notificationElement, timerId);
      });
    }
  }

  function handleNotificationRaised(message) {
    const notificationPayload = message.payload;
    if (!isValidNotificationPayload(notificationPayload)) {
      return;
    }

    renderNotification(notificationPayload);
  }

  function ensureNotificationDisplayListeners() {
    if (notificationDisplayListenersStarted) {
      return;
    }

    notificationDisplayListenersStarted = true;
    mesh.subscribe(
      NOTIFICATION_TOPIC,
      NOTIFICATION_RAISED_EVENT,
      handleNotificationRaised,
    );
  }

  function resetNotificationDisplayListeners() {
    notificationDisplayListenersStarted = false;
  }

  function unmount() {
    resetNotificationDisplayListeners();
    dismissalTimers.forEach((timerId) => window.clearTimeout(timerId));
    dismissalTimers.clear();
    containerElement.replaceChildren();
  }

  return {
    unmount,
    ensureNotificationDisplayListeners,
    resetNotificationDisplayListeners,
  };
}

export { mountNotificationCenter };
