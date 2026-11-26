/**
 * Verifies the product card custom element mounts, re-renders, and clears its card.
 * Role: Locks single registration, props set before and after connecting, and disconnect cleanup.
 * Not in this file: Card states (see product-card-component.test.js).
 * Key dependencies: node:test; vue; src/product-card-element.js; test/support/installCustomElements.js.
 * See also: src/product-card-element.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../test/support/installDomDocument.js";
import {
  connectElement,
  createCustomElement,
  disconnectElement,
  installCustomElements,
} from "../../../test/support/installCustomElements.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

installDomDocument();
installCustomElements();
const { nextTick } = await import("vue");
const { registerProductCardElement } = await loadAppModule(
  new URL("./product-card-element.js", import.meta.url).href,
);

const CARD_NAME = "vue-product-card";
const mug = { id: "mug", name: "Mug", price: 12, image: "mug.png", available: 3 };

test("registering twice defines the card element once", () => {
  registerProductCardElement();
  const firstClass = customElements.get(CARD_NAME);
  registerProductCardElement();
  assert.equal(customElements.get(CARD_NAME), firstClass);
});

test("props set before connecting render on connect, and new props replace the card", async () => {
  registerProductCardElement();
  const card = createCustomElement(CARD_NAME);
  card.props = { product: mug };
  assert.equal(card.textContent, "");
  assert.deepEqual(card.props, { product: mug });

  const { root } = installDomDocument();
  connectElement(card, root);
  await nextTick();
  try {
    assert.match(card.textContent, /Mug/);

    card.props = { product: { ...mug, name: "Lamp" } };
    await nextTick();
    assert.match(card.textContent, /Lamp/);
    assert.doesNotMatch(card.textContent, /Mug/);
  } finally {
    disconnectElement(card);
  }
  assert.equal(card.textContent, "");
});

test("a connected card with no props shows Product unavailable, and empty props reset it", async () => {
  registerProductCardElement();
  const { root } = installDomDocument();
  const card = connectElement(createCustomElement(CARD_NAME), root);
  await nextTick();
  try {
    assert.match(card.textContent, /Product unavailable\./);
    card.props = null;
    await nextTick();
    assert.deepEqual(card.props, {});
    assert.match(card.textContent, /Product unavailable\./);
  } finally {
    disconnectElement(card);
  }
});
