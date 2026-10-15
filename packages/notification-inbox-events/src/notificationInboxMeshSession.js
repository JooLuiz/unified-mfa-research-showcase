/**
 * Mesh session for one tab's notification inbox.
 * Role: Announces watching, subscribes to changed and read replies, and sends mark-read commands.
 * Not in this file: The in-memory list (src/notificationInboxClient.js) or the GET fetch.
 * Key dependencies: event-mesh/mesh; src/contracts.js.
 * See also: apps/mock-data-service/src/event-mesh/notificationInboxHandler.js.
 */

import mesh from "event-mesh/mesh";
import {
  NOTIFICATION_INBOX_CHANGED_EVENT,
  NOTIFICATION_INBOX_MARK_ALL_READ_EVENT,
  NOTIFICATION_INBOX_MARK_READ_EVENT,
  NOTIFICATION_INBOX_READ_ACCEPTED_EVENT,
  NOTIFICATION_INBOX_READ_ALL_ACCEPTED_EVENT,
  NOTIFICATION_INBOX_READ_ALL_REJECTED_EVENT,
  NOTIFICATION_INBOX_READ_REJECTED_EVENT,
  NOTIFICATION_INBOX_TOPIC,
  NOTIFICATION_INBOX_WATCHING_EVENT,
} from "./contracts.js";

const WATCHING_ANNOUNCE_INTERVAL_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;
const COMMAND_TIMEOUT_MS = 15_000;

/**
 * Creates the mesh session that pushes changed rows and answers mark-read commands.
 *
 * @param {{ onChanged: (notification: object) => void }} sessionInput - Called for each changed row.
 * @returns {{ start: (shell: string) => void, stop: () => void, sendMarkRead: (notificationId: string) => Promise<object>, sendMarkAllRead: (shell: string) => Promise<object> }} Session controls.
 */
function createNotificationInboxMeshSession({ onChanged }) {
  /** @type {Array<() => void>} */
  let unsubscribeFunctions = [];
  let watchingIntervalId = null;
  /** @type {{ requestId: string, resolve: (outcome: object) => void } | null} */
  let pendingCommand = null;
  let activeShell = "";

  function publishWatching() {
    if (!activeShell) {
      return;
    }
    mesh.publish({
      topic: NOTIFICATION_INBOX_TOPIC,
      event: NOTIFICATION_INBOX_WATCHING_EVENT,
      payload: { shell: activeShell },
      scope: "distributed",
    });
  }

  function resolvePendingCommand(message, outcome) {
    if (!pendingCommand || message.payload?.requestId !== pendingCommand.requestId) {
      return;
    }
    const resolveCommand = pendingCommand.resolve;
    pendingCommand = null;
    resolveCommand(outcome);
  }

  function stop() {
    activeShell = "";
    unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    unsubscribeFunctions = [];
    if (watchingIntervalId) {
      window.clearInterval(watchingIntervalId);
      watchingIntervalId = null;
    }
    if (pendingCommand) {
      pendingCommand.resolve({ ok: false, code: "stopped" });
      pendingCommand = null;
    }
  }

  /**
   * Subscribes to inbox events and starts the watching announce for one shell.
   *
   * @param {string} shell - Shell name the tab is showing.
   * @returns {void}
   * @sideEffects Subscribes on the mesh client and publishes notification-inbox/watching.
   */
  function start(shell) {
    stop();
    activeShell = shell;
    const subscriptions = [
      mesh.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_CHANGED_EVENT, (message) => {
        onChanged(message.payload);
      }),
      mesh.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_READ_ACCEPTED_EVENT, (message) => {
        resolvePendingCommand(message, { ok: true, notification: message.payload?.notification });
      }),
      mesh.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_READ_REJECTED_EVENT, (message) => {
        resolvePendingCommand(message, { ok: false, code: message.payload?.code || "request-failed" });
      }),
      mesh.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_READ_ALL_ACCEPTED_EVENT, (message) => {
        resolvePendingCommand(message, {
          ok: true,
          items: Array.isArray(message.payload?.items) ? message.payload.items : [],
        });
      }),
      mesh.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_READ_ALL_REJECTED_EVENT, (message) => {
        resolvePendingCommand(message, { ok: false, code: message.payload?.code || "request-failed" });
      }),
    ];
    unsubscribeFunctions = subscriptions.filter((unsubscribe) => typeof unsubscribe === "function");
    publishWatching();
    watchingIntervalId = window.setInterval(publishWatching, WATCHING_ANNOUNCE_INTERVAL_MS);
  }

  function waitForCommand(requestId) {
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        if (pendingCommand?.requestId === requestId) {
          pendingCommand = null;
        }
        resolve({ ok: false, code: "timeout" });
      }, COMMAND_TIMEOUT_MS);
      pendingCommand = {
        requestId,
        resolve: (outcome) => {
          window.clearTimeout(timeoutId);
          resolve(outcome);
        },
      };
    });
  }

  async function sendCommand(event, payload) {
    const requestId = `notification-inbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    const outcomePromise = waitForCommand(requestId);
    mesh.publish({
      topic: NOTIFICATION_INBOX_TOPIC,
      event,
      payload: { requestId, ...payload },
      scope: "distributed",
    });
    return outcomePromise;
  }

  return {
    start,
    stop,
    sendMarkRead: (notificationId) => sendCommand(NOTIFICATION_INBOX_MARK_READ_EVENT, { notificationId }),
    sendMarkAllRead: (shell) => sendCommand(NOTIFICATION_INBOX_MARK_ALL_READ_EVENT, { shell }),
  };
}

export { createNotificationInboxMeshSession, MESH_CONNECT_TIMEOUT_MS };
