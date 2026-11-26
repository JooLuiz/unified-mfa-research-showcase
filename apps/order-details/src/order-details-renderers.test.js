/**
 * Verifies which status buttons the order header shows for each actor and status.
 * Role: Locks the admin and customer action labels and the status each button requests.
 * Not in this file: Load states and order sections (see OrderDetailsView.test.js).
 * Key dependencies: node:test; vue; src/order-details-renderers.js; test/support/mountVueComponent.js.
 * See also: src/order-details-renderers.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../test/support/installBrowserGlobals.js";
import { findElement } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";
import { mountVueComponent } from "../../../test/support/mountVueComponent.js";

const { renderOrderHeader } = await loadAppModule(new URL("./order-details-renderers.js", import.meta.url).href);

/**
 * Renders one order header and returns its action labels.
 *
 * @param {object} order - Order shown in the header.
 * @param {string} actor - "admin" or "customer".
 * @param {(status: string) => void} [onStatusAction] - Status action handler.
 * @returns {Promise<{ root: object, labels: string[], unmount: () => void }>} Mounted header and its button labels.
 */
async function mountHeader(order, actor, onStatusAction = () => {}) {
  const mounted = await mountVueComponent({ render: () => renderOrderHeader(order, { actor, onStatusAction }) });
  const actions = findElement(mounted.root, (node) => node.classList && node.classList.contains("order-details-actions"));
  return { ...mounted, labels: actions.childNodes.map((button) => button.textContent) };
}

test("an admin sees the next steps for placed, shipped, and cancellation-requested orders", async () => {
  const expectations = [
    ["placed", ["Ship", "Cancel"]],
    ["shipped", ["Deliver"]],
    ["cancellation-requested", ["Accept", "Decline"]],
    ["delivered", []],
  ];
  for (const [status, labels] of expectations) {
    const mounted = await mountHeader({ id: "order-01", status }, "admin");
    try {
      assert.deepEqual(mounted.labels, labels);
    } finally {
      mounted.unmount();
    }
  }
});

test("a customer can only request cancellation of a placed order", async () => {
  const requested = [];
  const placed = await mountHeader({ id: "order-01" }, "customer", (status) => requested.push(status));
  try {
    assert.deepEqual(placed.labels, ["Request cancellation"]);
    assert.match(placed.root.textContent, /Placed/);
    const button = findElement(placed.root, (node) => node.nodeName === "BUTTON");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(requested, ["cancellation-requested"]);
  } finally {
    placed.unmount();
  }

  const shipped = await mountHeader({ id: "order-02", status: "shipped" }, "customer");
  try {
    assert.deepEqual(shipped.labels, []);
  } finally {
    shipped.unmount();
  }
});
