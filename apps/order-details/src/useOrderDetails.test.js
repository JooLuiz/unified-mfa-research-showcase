/**
 * Verifies the order-details composable state a shopper's page renders from.
 * Role: Locks order-id parsing, the provided-order shortcut, status updates for the shown order only,
 *   load cancellation on unmount, and the stored-token fallback shared by both comparison branches.
 * Not in this file: Rendering (src/OrderDetailsView.js) or status writes.
 * Key dependencies: node:test; vue; src/useOrderDetails.js; @shared/order-status-events;
 *   test/support/createRecordingTransport.js.
 * See also: src/useOrderDetails.js; src/order-details-utils.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  startCustomerOrderStatusStream,
  stopCustomerOrderStatusStream,
} from "@shared/order-status-events";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import "../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";
import { mountVueComposable } from "../../../test/support/mountVueComponent.js";

installDomDocument();
const { nextTick } = await import("vue");
const { useOrderDetails } = await loadAppModule(
  new URL("./useOrderDetails.js", import.meta.url).href,
);

const API_BASE_URL = "http://localhost:4000";
const AUTH_TOKEN_STORAGE_KEY = "ecommerce-shell:auth-token";

/**
 * Mounts a probe component that runs the composable.
 *
 * @param {object} props - Composable props.
 * @returns {{ read: () => object, state: object, unmount: () => void }} Latest composable result, reactive props, and unmount.
 */
function mountOrderDetails(props) {
  return mountVueComposable(useOrderDetails, props);
}

/** Lets pending fetch promises settle and Vue flush. */
async function flushRequests() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/**
 * Runs one test with a stand-in fetch and a page path, then restores fetch, path, and stored token.
 *
 * @param {{ pathname?: string, fetchStub: (url: string, options: object) => Promise<object> }} setup - Page path and fetch.
 * @param {() => Promise<void>} run - Test body.
 * @returns {Promise<void>}
 */
async function withPage({ pathname = "/", fetchStub }, run) {
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

/** Fetch stand-in that fails the test if a request is sent. */
function createRefusingFetch() {
  const calls = [];
  const fetchStub = async (url) => {
    calls.push(String(url));
    throw new Error("fetch should not run");
  };
  return { calls, fetchStub };
}

for (const pathname of ["/orders/order-01", "/order-details/a/b"]) {
  test(`the path ${pathname} reports a missing order id and sends no request`, async () => {
    const refusing = createRefusingFetch();
    await withPage({ pathname, fetchStub: refusing.fetchStub }, async () => {
      const mounted = mountOrderDetails({ apiBaseUrl: API_BASE_URL });
      try {
        await flushRequests();
        assert.equal(mounted.read().isMissingOrderId.value, true);
        assert.equal(mounted.read().orderData.value, null);
        assert.deepEqual(refusing.calls, []);
      } finally {
        mounted.unmount();
      }
    });
  });
}

test("a provided order is shown without a request", async () => {
  const refusing = createRefusingFetch();
  const order = { id: "order-01", status: "placed" };
  await withPage({ pathname: "/order-details/order-01", fetchStub: refusing.fetchStub }, async () => {
    const mounted = mountOrderDetails({ apiBaseUrl: API_BASE_URL, order });
    try {
      await flushRequests();
      assert.deepEqual(mounted.read().orderData.value, order);
      assert.equal(mounted.read().isMissingOrderId.value, false);
      assert.deepEqual(refusing.calls, []);
    } finally {
      mounted.unmount();
    }
  });
});

test("a status change for another order leaves the shown order unchanged", async () => {
  const refusing = createRefusingFetch();
  const transport = createRecordingTransport();
  await withPage({ fetchStub: refusing.fetchStub }, async () => {
    startCustomerOrderStatusStream(transport);
    const mounted = mountOrderDetails({
      apiBaseUrl: API_BASE_URL,
      order: { id: "order-01", status: "placed" },
    });
    try {
      transport.deliver("orders", "status-changed", { orderId: "order-99", status: "shipped" });
      assert.equal(mounted.read().orderData.value.status, "placed");

      transport.deliver("orders", "status-changed", { orderId: "order-01", status: "shipped" });
      assert.equal(mounted.read().orderData.value.status, "shipped");
    } finally {
      mounted.unmount();
      stopCustomerOrderStatusStream();
    }
  });
});

test("unmounting cancels the pending order load", async () => {
  const signals = [];
  const fetchStub = (_url, options) => {
    signals.push(options.signal);
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const abortError = new Error("aborted");
        abortError.name = "AbortError";
        reject(abortError);
      });
    });
  };
  await withPage({ pathname: "/order-details/order-01", fetchStub }, async () => {
    const mounted = mountOrderDetails({ apiBaseUrl: API_BASE_URL });
    await flushRequests();
    assert.equal(mounted.read().isLoading.value, true);

    mounted.unmount();
    await flushRequests();
    assert.equal(signals.length, 1);
    assert.equal(signals[0].aborted, true);
    assert.equal(mounted.read().orderData.value, null);
  });
});

test("without a token prop the order request uses the stored shopper token", async () => {
  const requests = [];
  const fetchStub = async (url, options) => {
    requests.push({ url: String(url), headers: options.headers });
    return { ok: true, status: 200, json: async () => ({ id: "order-01", status: "placed" }) };
  };
  await withPage({ pathname: "/order-details/order-01", fetchStub }, async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "stored-token");
    const mounted = mountOrderDetails({ apiBaseUrl: API_BASE_URL });
    try {
      await flushRequests();
      assert.match(requests[0].url, /\/orders\/order-01$/);
      assert.equal(requests[0].headers.Authorization, "Bearer stored-token");
      assert.equal(mounted.read().orderData.value.id, "order-01");
      assert.equal(mounted.read().isLoading.value, false);
    } finally {
      mounted.unmount();
    }
  });
});
