/**
 * Renders and manages a persistent toast queue for a shell.
 * Role: Converts page-local notification requests into accessible, auto-dismissing toast elements.
 * Not in this file: Business outcome decisions, backend transport, or route-specific UI.
 * Key dependencies: A notification adapter created by createNotificationAdapter.
 * See also: src/createNotificationAdapter.js.
 */

const DEFAULT_DURATION_MS = 5000;

/**
 * Mounts the notification center in a persistent shell-level container.
 *
 * @param {HTMLElement} containerElement - Element that owns the rendered toast queue.
 * @param {{ subscribeToNotifications: (listener: (notification: object) => void) => () => void, onOpenLink?: (notification: { link?: string }) => void }} notificationBus - Bus that delivers notification requests, plus an optional click handler for toasts that carry a link.
 * @returns {() => void} Function that clears pending timers, subscriptions, and rendered toasts.
 * @sideEffects Subscribes to notification events and mutates the supplied container.
 */
function mountNotificationCenter(containerElement, notificationBus) {
  const dismissalTimers = new Set();

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

  const unsubscribe = notificationBus.subscribeToNotifications((notification) => {
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

    const hasDetailLink =
      typeof notification.link === "string" && notification.link.length > 0;
    if (hasDetailLink && typeof notificationBus.onOpenLink === "function") {
      notificationElement.classList.add("notification-toast--linked");
      notificationElement.addEventListener("click", () => {
        notificationBus.onOpenLink(notification);
        dismissNotification(notificationElement, timerId);
      });
    }
  });

  return () => {
    unsubscribe();
    dismissalTimers.forEach((timerId) => window.clearTimeout(timerId));
    dismissalTimers.clear();
    containerElement.replaceChildren();
  };
}

export { mountNotificationCenter };
