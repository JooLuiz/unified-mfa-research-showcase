/**
 * Loads and replaces the authenticated cart for the ecommerce shell.
 * Role: Reads the saved cart over HTTP and replaces it with a cart-sync/upsert mesh message.
 * Not in this file: Local cart mutation, login merge, or applying pushed carts (src/utils/cartSync.js).
 * Key dependencies: Mock data service GET /api/cart; event-mesh/mesh.
 * See also: src/utils/cartSync.js; apps/mock-data-service/src/event-mesh/cartUpsertHandler.js.
 */

import mesh from "event-mesh/mesh";
import { MOCK_API_BASE_URL } from "../utils/constants";
import fetchJson from "../utils/fetchJson";
import {
  CART_CHANGED_EVENT_TYPE,
  CART_SYNC_TOPIC,
  CART_UPSERT_EVENT,
  CART_UPSERT_REJECTED_EVENT,
  CART_WATCHING_EVENT,
} from "../events/cartLiveEventsContracts";

const CART_SAVE_TIMEOUT_MS = 15000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/** @type {{ requestId: string, resolve: (outcome: { ok: boolean }) => void } | null} */
let pendingSaveWaiter = null;
let saveListenersStarted = false;

function resolveSaveWaiter(outcome) {
  if (!pendingSaveWaiter) {
    return;
  }
  const resolveWaiter = pendingSaveWaiter.resolve;
  pendingSaveWaiter = null;
  resolveWaiter(outcome);
}

/**
 * Subscribes once to the save echo and the rejection reply.
 *
 * @returns {void}
 * @sideEffects Registers mesh subscribers until resetCartSaveListeners runs.
 */
function ensureCartSaveListeners() {
  if (saveListenersStarted) {
    return;
  }
  saveListenersStarted = true;
  mesh.subscribe(CART_SYNC_TOPIC, CART_CHANGED_EVENT_TYPE, (message) => {
    if (!pendingSaveWaiter || message.payload?.requestId !== pendingSaveWaiter.requestId) {
      return;
    }
    resolveSaveWaiter({ ok: true });
  });
  mesh.subscribe(CART_SYNC_TOPIC, CART_UPSERT_REJECTED_EVENT, (message) => {
    if (!pendingSaveWaiter || message.payload?.requestId !== pendingSaveWaiter.requestId) {
      return;
    }
    resolveSaveWaiter({ ok: false });
  });
}

/**
 * Clears save listeners so the next upsert re-subscribes after mesh.close().
 *
 * @returns {void}
 */
function resetCartSaveListeners() {
  saveListenersStarted = false;
  pendingSaveWaiter = null;
}

function waitForCartSave(requestId) {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      if (pendingSaveWaiter?.requestId === requestId) {
        pendingSaveWaiter = null;
      }
      resolve({ ok: false });
    }, CART_SAVE_TIMEOUT_MS);

    pendingSaveWaiter = {
      requestId,
      resolve: (outcome) => {
        window.clearTimeout(timeoutId);
        resolve(outcome);
      },
    };
  });
}

/**
 * Loads the signed-in user's saved cart.
 *
 * @param {string} authToken - Bearer token for the current user.
 * @returns {Promise<{ ok: true, cart: { items: object[], appliedCoupon: object | null, updatedAt?: string | null } } | { ok: false }>} Saved cart, or failure.
 * @sideEffects Performs the HTTP cart read.
 */
async function fetchSavedCart(authToken) {
  try {
    const cart = await fetchJson(`${MOCK_API_BASE_URL}/cart`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    return { ok: true, cart };
  } catch (error) {
    console.warn("fetchSavedCart - error");
    console.warn(error);
    return { ok: false };
  }
}

/**
 * Replaces the signed-in user's saved cart through the gateway.
 *
 * @param {string} _authToken - Unused. The open mesh connection already carries the user credential.
 * @param {{ items: object[], appliedCoupon: object | null }} cartPayload - Items and coupon to store.
 * @returns {Promise<{ ok: boolean }>} Whether the gateway accepted the cart.
 * @sideEffects Publishes cart-sync/watching and cart-sync/upsert, then waits for the stored cart or a rejection.
 */
async function saveSavedCart(_authToken, cartPayload) {
  const requestId = `cart-save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    ensureCartSaveListeners();
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    const saveOutcomePromise = waitForCartSave(requestId);
    mesh.publish({
      topic: CART_SYNC_TOPIC,
      event: CART_WATCHING_EVENT,
      payload: {},
      scope: "distributed",
    });
    mesh.publish({
      topic: CART_SYNC_TOPIC,
      event: CART_UPSERT_EVENT,
      payload: {
        items: cartPayload.items,
        appliedCoupon: cartPayload.appliedCoupon,
        requestId,
      },
      scope: "distributed",
    });
    return await saveOutcomePromise;
  } catch (error) {
    console.warn("saveSavedCart - error");
    console.warn(error);
    return { ok: false };
  }
}

export { fetchSavedCart, resetCartSaveListeners, saveSavedCart };
