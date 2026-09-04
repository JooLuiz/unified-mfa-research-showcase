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
 * @returns {{ unmount: () => void, ensureNotificationDisplayListeners: () => void, resetNotificationDisplayListeners: () => void }} Lifecycle API for toast display and mesh subscription management.
 * @sideEffects Mutates the supplied container; registers mesh listeners when ensure is called.
 */
function mountNotificationCenter(containerElement, mesh) {
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
    dismissButton.addEventListener("click", () =>
      dismissNotification(notificationElement, timerId),
    );
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
