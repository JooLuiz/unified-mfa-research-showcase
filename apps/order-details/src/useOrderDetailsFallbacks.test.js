/**
 * Verifies order-details composable fallbacks: unreadable paths and tokens, failed and replaced
 *   loads, the admin actor, and status actions.
 * Role: Locks the order state a page renders from when inputs are missing or a request fails.
 * Not in this file: The happy-path load and customer status updates (see useOrderDetails.test.js).
 * Key dependencies: node:test; vue; src/useOrderDetails.js; @shared/order-status-events;
 *   test/support/createRecordingTransport.js; test/support/mountVueComponent.js.
 * See also: src/useOrderDetails.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { startAdminOrderStatusStream, stopAdminOrderStatusStream } from "@shared/order-status-events";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import "../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";
import { mountVueComposable } from "../../../test/support/mountVueComponent.js";

const { nextTick } = await import("vue");
const { useOrderDetails } = await loadAppModule(new URL("./useOrderDetails.js", import.meta.url).href);

const API_BASE_URL = "http://localhost:4000";
const AUTH_TOKEN_STORAGE_KEY = "ecommerce-shell:auth-token";

/** Lets pending fetch promises settle and Vue flush. */
async function flushRequests() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/**
 * Runs one test with a stand-in fetch and a page path, then restores fetch, path, and stored token.
 *
 * @param {{ pathname?: string, fetchStub?: (url: string, options: object) => Promise<object> }} setup - Page path and fetch.
 * @param {() => Promise<void>} run - Test body.
 * @returns {Promise<void>}
 */
async function withPage({ pathname = "/", fetchStub = async () => { throw new Error("fetch should not run"); } }, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;
  window.location.pathname = pathname;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    window.location.pathname = "/";
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

for (const pathname of ["", "/order-details/%E0%A4%A"]) {
  test(`the unreadable path "${pathname}" reports a missing order id`, async () => {
    await withPage({ pathname }, async () => {
      const mounted = mountVueComposable(useOrderDetails, { apiBaseUrl: API_BASE_URL });
      try {
        await flushRequests();
        assert.equal(mounted.read().isMissingOrderId.value, true);
        assert.equal(mounted.read().orderData.value, null);
      } finally {
        mounted.unmount();
      }
    });
  });
}

test("no API base URL and no provided order leaves the order empty", async () => {
  await withPage({ pathname: "/order-details/order-01" }, async () => {
    const mounted = mountVueComposable(useOrderDetails, {});
    try {
      await flushRequests();
      assert.equal(mounted.read().orderData.value, null);
      assert.equal(mounted.read().isMissingOrderId.value, false);
      assert.equal(mounted.read().actor, "customer");
    } finally {
      mounted.unmount();
    }
  });
});

test("a token prop and a custom request path are used, and a failed response keeps its status", async () => {
  const requests = [];
  const fetchStub = async (url, options) => {
    requests.push({ url: String(url), headers: options.headers });
    return { ok: false, status: 403, statusText: "Forbidden", json: async () => ({}) };
  };
  await withPage({ pathname: "/order-details/order-01", fetchStub }, async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "stored-token");
    const originalWarn = console.warn;
    console.warn = () => {};
    const mounted = mountVueComposable(useOrderDetails, {
      apiBaseUrl: API_BASE_URL,
      authToken: "prop-token",
      buildOrderRequestPath: (orderId) => `/admin/orders/${orderId}`,
    });
    try {
      await flushRequests();
      assert.match(requests[0].url, /\/admin\/orders\/order-01$/);
      assert.equal(requests[0].headers.Authorization, "Bearer prop-token");
      assert.equal(mounted.read().loadError.value.status, 403);
      assert.equal(mounted.read().orderData.value, null);
      assert.equal(mounted.read().isLoading.value, false);
    } finally {
      console.warn = originalWarn;
      mounted.unmount();
    }
  });
});

test("an unreadable stored token sends the request without a token", async () => {
  const requests = [];
  const fetchStub = async (url, options) => {
    requests.push(options.headers);
    return { ok: true, status: 200, json: async () => ({ id: "order-01", status: "placed" }) };
  };
  await withPage({ pathname: "/order-details/order-01", fetchStub }, async () => {
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error("storage blocked");
    };
    const mounted = mountVueComposable(useOrderDetails, { apiBaseUrl: API_BASE_URL });
    try {
      await flushRequests();
      assert.equal(requests[0].Authorization, undefined);
      assert.equal(mounted.read().orderData.value.id, "order-01");
    } finally {
      localStorage.getItem = originalGetItem;
      mounted.unmount();
    }
  });
});

test("a new API base URL cancels the pending load and shows the new reply", async () => {
  const signals = [];
  const fetchStub = (url, options) => {
    signals.push(options.signal);
    if (signals.length === 1) {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ id: "order-01", status: "shipped" }) });
  };
  await withPage({ pathname: "/order-details/order-01", fetchStub }, async () => {
    const mounted = mountVueComposable(useOrderDetails, { apiBaseUrl: API_BASE_URL });
    try {
      await flushRequests();
      mounted.state.apiBaseUrl = "http://localhost:4001";
      await nextTick();
      await flushRequests();
      assert.equal(signals[0].aborted, true);
      assert.equal(mounted.read().orderData.value.status, "shipped");
      assert.equal(mounted.read().isLoading.value, false);
    } finally {
      mounted.unmount();
    }
  });
});

test("an admin view hears admin status changes for the shown order", async () => {
  const transport = createRecordingTransport();
  await withPage({}, async () => {
    startAdminOrderStatusStream(transport);
    const mounted = mountVueComposable(useOrderDetails, {
      apiBaseUrl: API_BASE_URL,
      actor: "admin",
      order: { id: "order-01", status: "placed" },
    });
    try {
      assert.equal(mounted.read().actor, "admin");
      transport.deliver("orders", "status-changed", { orderId: "order-01", status: "shipped" });
      assert.equal(mounted.read().orderData.value.status, "shipped");
    } finally {
      mounted.unmount();
      stopAdminOrderStatusStream();
    }
  });
});

test("a status action needs a token, applies an accepted change, and reports a rejection", async () => {
  const order = { id: "order-01", status: "placed" };
  const transport = createRecordingTransport({
    requestReplies: [
      { ok: true, order: { ...order, status: "cancellation-requested" } },
      { ok: false, code: "order-status-transition-invalid" },
      { ok: false, code: "order-status-transition-invalid" },
    ],
  });
  const rejections = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  await withPage({}, async () => {
    const guest = mountVueComposable(useOrderDetails, { apiBaseUrl: API_BASE_URL, order, transport });
    const shopper = mountVueComposable(useOrderDetails, {
      apiBaseUrl: API_BASE_URL,
      order,
      transport,
      authToken: "token-01",
      onStatusRejected: (result) => rejections.push(result.code),
    });
    const quietShopper = mountVueComposable(useOrderDetails, {
      apiBaseUrl: API_BASE_URL,
      order,
      transport,
      authToken: "token-01",
    });
    try {
      await guest.read().applyStatusAction("cancellation-requested");
      assert.equal(guest.read().orderData.value.status, "placed");

      await shopper.read().applyStatusAction("cancellation-requested");
      assert.equal(shopper.read().orderData.value.status, "cancellation-requested");

      await shopper.read().applyStatusAction("cancellation-requested");
      assert.deepEqual(rejections, ["order-status-transition-invalid"]);

      await quietShopper.read().applyStatusAction("cancellation-requested");
      assert.equal(quietShopper.read().orderData.value.status, "placed");
    } finally {
      console.warn = originalWarn;
      guest.unmount();
      shopper.unmount();
      quietShopper.unmount();
    }
  });
});
