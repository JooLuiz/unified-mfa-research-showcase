/**
 * Maps shell command names onto gateway events and HTTP reads.
 * Role: Tells the shell transport which mesh event to publish and which reply to wait for.
 * Not in this file: The Event Mesh client. Callers pass publish and subscribe in.
 * Key dependencies: None.
 * See also: src/events/eventBus.js; apps/mock-data-service/src/inbound/.
 */

const COMMAND_TIMEOUT_MS = 15000;
const CONNECT_TIMEOUT_MS = 5000;

const SUBSCRIBE_ALIASES = {
  "cart:live-changed": { topic: "cart-sync", event: "changed" },
  "admin-live:order-created": { topic: "admin", event: "order_created" },
  "admin-live:post-created": { topic: "admin", event: "post_created" },
  "admin-live:likes-changed": { topic: "admin", event: "post_likes_changed" },
};

const EXPORT_FILE_NAMES = {
  orders: "my-orders.csv",
  posts: "my-posts.csv",
};

const MESH_COMMANDS = {
  "orders:status-change": {
    publishTopic: "orders",
    publishEvent: "status-change-requested",
    acceptEvent: "status-accepted",
    rejectEvent: "status-rejected",
    toMeshPayload(payload, requestId) {
      return {
        requestId,
        orderId: payload.orderId,
        nextStatus: payload.status,
        actor: payload.actor,
      };
    },
    toOutcome(payload) {
      return payload.order
        ? { ok: true, order: payload.order }
        : { ok: false, code: payload.code || "request-failed" };
    },
  },
  "orders:place": {
    publishTopic: "orders",
    publishEvent: "requested",
    acceptEvent: "accepted",
    matchRequestId: false,
    toMeshPayload(payload) {
      return payload;
    },
    toOutcome(payload) {
      return { ok: true, order: payload.order };
    },
  },
  "stock:reserve": {
    publishTopic: "stock",
    publishEvent: "reserve",
    acceptEvent: "accepted",
    rejectEvent: "rejected",
    toMeshPayload(payload, requestId) {
      return {
        requestId,
        productId: payload.productId,
        quantity: payload.quantity,
        sessionId: payload.sessionId || "",
      };
    },
    toOutcome(payload) {
      return payload.code
        ? { ok: false, code: payload.code }
        : { ok: true, quantity: payload.quantity, available: payload.available };
    },
  },
  "stock:set": {
    publishTopic: "stock",
    publishEvent: "release",
    acceptEvent: "accepted",
    rejectEvent: "rejected",
    toMeshPayload(payload, requestId) {
      return {
        requestId,
        productId: payload.productId,
        quantity: payload.quantity,
        sessionId: payload.sessionId || "",
      };
    },
    toOutcome(payload) {
      return payload.code
        ? { ok: false, code: payload.code }
        : { ok: true, quantity: payload.quantity, available: payload.available };
    },
  },
  "community-likes:toggle": {
    publishTopic: "community-likes",
    publishEvent: "toggle",
    acceptEvent: "accepted",
    rejectEvent: "rejected",
    toMeshPayload(payload, requestId) {
      return { requestId, postId: payload.postId };
    },
    toOutcome(payload) {
      return payload.code
        ? { ok: false, code: payload.code }
        : { ok: true, liked: payload.liked, likes: payload.likes };
    },
  },
  "cart:save": {
    publishTopic: "cart-sync",
    publishEvent: "upsert",
    acceptEvent: "changed",
    rejectEvent: "upsert-rejected",
    timeoutResult: { ok: false },
    networkResult: { ok: false },
    beforePublish: { topic: "cart-sync", event: "watching", payload: {}, scope: "distributed" },
    toMeshPayload(payload, requestId) {
      return {
        requestId,
        items: payload.cart?.items || [],
        appliedCoupon: payload.cart?.appliedCoupon ?? null,
        ...(payload.guestStockSessionIdToRelease
          ? { guestStockSessionIdToRelease: payload.guestStockSessionIdToRelease }
          : {}),
      };
    },
    toOutcome(payload) {
      return payload.code ? { ok: false, code: payload.code } : { ok: true };
    },
  },
  "notification-inbox:mark-read": {
    publishTopic: "notification-inbox",
    publishEvent: "mark-read",
    acceptEvent: "read-accepted",
    rejectEvent: "read-rejected",
    toMeshPayload(payload, requestId) {
      return { requestId, notificationId: payload.notificationId };
    },
    toOutcome(payload) {
      return payload.notification
        ? { ok: true, notification: payload.notification }
        : { ok: false, code: payload.code || "request-failed" };
    },
  },
  "notification-inbox:mark-all-read": {
    publishTopic: "notification-inbox",
    publishEvent: "mark-all-read",
    acceptEvent: "read-all-accepted",
    rejectEvent: "read-all-rejected",
    toMeshPayload(payload, requestId) {
      return { requestId, shell: payload.shell };
    },
    toOutcome(payload) {
      return payload.items
        ? { ok: true, items: payload.items }
        : { ok: false, code: payload.code || "request-failed" };
    },
  },
  "exports:csv": {
    publishTopic: "exports",
    publishEvent: "requested",
    acceptEvent: "completed",
    rejectEvent: "failed",
    toMeshPayload(payload, requestId) {
      return { requestId, kind: payload.kind };
    },
    toOutcome(payload) {
      return payload.code
        ? { ok: false, code: payload.code }
        : { ok: true, jobId: payload.jobId };
    },
  },
};

/**
 * Returns the gateway topic and event for a contract subscription.
 *
 * @param {string} topic - Contract topic.
 * @param {string} event - Contract event.
 * @returns {{ topic: string, event: string }} Gateway pair. Unlisted pairs pass through.
 */
function resolveSubscribeTarget(topic, event) {
  return SUBSCRIBE_ALIASES[`${topic}:${event}`] || { topic, event };
}

/**
 * Runs one shell command through the gateway or through HTTP when the gateway has no event for it.
 *
 * @param {{ mesh: { publish: Function, subscribe: Function, whenConnected: Function }, getAuthToken: () => string, apiBaseUrl: string, topic: string, event: string, payload?: object }} commandInput
 * @returns {Promise<object>} Command outcome.
 * @sideEffects Publishes a gateway message or performs an HTTP read or download.
 */
async function runMeshCommand({ mesh, getAuthToken, apiBaseUrl, topic, event, payload }) {
  const httpOutcome = await runHttpCommand({
    topic,
    event,
    payload,
    getAuthToken,
    apiBaseUrl,
  });
  if (httpOutcome) {
    return httpOutcome;
  }

  const command = MESH_COMMANDS[`${topic}:${event}`];
  if (!command) {
    return { ok: false, code: "request-failed" };
  }

  try {
    await mesh.whenConnected({ timeoutMs: CONNECT_TIMEOUT_MS });
    const requestId = `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const outcomePromise = waitForCommandReply(mesh, command, requestId);
    if (command.beforePublish) {
      mesh.publish(command.beforePublish);
    }
    mesh.publish({
      topic: command.publishTopic,
      event: command.publishEvent,
      payload: command.toMeshPayload(payload || {}, requestId),
      scope: "distributed",
    });
    const outcome = await outcomePromise;
    if (command.publishEvent === "requested" && outcome.ok && outcome.jobId) {
      await downloadExportFile({ apiBaseUrl, getAuthToken, jobId: outcome.jobId, kind: payload?.kind });
    }
    return outcome;
  } catch (error) {
    console.warn("runMeshCommand - error");
    console.warn(error);
    return command.networkResult || { ok: false, code: "network-error" };
  }
}

/**
 * @param {{ publish: Function, subscribe: Function }} mesh
 * @param {object} command
 * @param {string} requestId
 * @returns {Promise<object>}
 */
function waitForCommandReply(mesh, command, requestId) {
  return new Promise((resolve) => {
    let settled = false;
    const unsubscribeFns = [];

    function finish(outcome) {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
      resolve(outcome);
    }

    const timeoutId = window.setTimeout(() => {
      finish(command.timeoutResult || { ok: false, code: "timeout" });
    }, COMMAND_TIMEOUT_MS);

    function handleReply(message, accepted) {
      const replyPayload = message.payload || {};
      if (command.matchRequestId !== false && replyPayload.requestId !== requestId) {
        return;
      }
      finish(accepted ? command.toOutcome(replyPayload) : { ok: false, code: replyPayload.code || "request-failed" });
    }

    unsubscribeFns.push(
      mesh.subscribe(command.publishTopic, command.acceptEvent, (message) => handleReply(message, true)),
    );
    if (command.rejectEvent) {
      unsubscribeFns.push(
        mesh.subscribe(command.publishTopic, command.rejectEvent, (message) => handleReply(message, false)),
      );
    }
  });
}

/**
 * @returns {Promise<object | null>} An HTTP outcome, or null when this command is a gateway command.
 */
async function runHttpCommand({ topic, event, payload, getAuthToken, apiBaseUrl }) {
  const authToken = getAuthToken() || payload?.authToken || "";
  if (topic === "cart" && event === "fetch") {
    if (!authToken) {
      return { ok: false };
    }
    const response = await fetch(`${apiBaseUrl}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) {
      return { ok: false };
    }
    return { ok: true, cart: await response.json() };
  }
  if (topic === "notification-inbox" && event === "fetch") {
    if (!authToken || !payload?.shell) {
      return { ok: true, items: [] };
    }
    const response = await fetch(
      `${apiBaseUrl}/notifications?shell=${encodeURIComponent(payload.shell)}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    if (!response.ok) {
      return { ok: false, code: "request-failed" };
    }
    const body = await response.json();
    return { ok: true, items: Array.isArray(body.items) ? body.items : [] };
  }
  if (topic === "session" && event === "sign-out-everywhere") {
    if (!authToken) {
      return { ok: false, status: 401 };
    }
    const response = await fetch(`${apiBaseUrl}/auth/sign-out-everywhere`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return { ok: response.ok, status: response.status };
  }
  return null;
}

/**
 * @returns {Promise<void>}
 * @sideEffects Saves the export file when a document is available.
 */
async function downloadExportFile({ apiBaseUrl, getAuthToken, jobId, kind }) {
  const response = await fetch(`${apiBaseUrl}/exports/${encodeURIComponent(jobId)}/download`, {
    headers: { Authorization: `Bearer ${getAuthToken() || ""}` },
  });
  if (!response.ok || typeof document === "undefined") {
    return;
  }
  const fileBlob = await response.blob();
  const objectUrl = URL.createObjectURL(fileBlob);
  const downloadElement = document.createElement("a");
  downloadElement.href = objectUrl;
  downloadElement.download = EXPORT_FILE_NAMES[kind] || "export.csv";
  downloadElement.style.display = "none";
  document.body.appendChild(downloadElement);
  downloadElement.click();
  downloadElement.remove();
  URL.revokeObjectURL(objectUrl);
}

export { resolveSubscribeTarget, runMeshCommand };
