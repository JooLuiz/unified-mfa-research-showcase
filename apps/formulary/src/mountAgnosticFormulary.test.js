/**
 * Verifies the iframe formulary a shopper or member fills in for each form type.
 * Role: Locks the form chosen by the `type` query, query autofill, field defaults, and that only a
 *   valid submit clears the form.
 * Not in this file: The message sent to the host page, which is the host's channel.
 * Key dependencies: node:test; vue; src/mountAgnosticFormulary.js; test/support/installDomDocument.js.
 * See also: src/mountAgnosticFormulary.js; src/faq-formulary.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

installDomDocument();
const { nextTick } = await import("vue");
globalThis.requestAnimationFrame ??= (callback) => setTimeout(callback, 0);
window.requestAnimationFrame ??= globalThis.requestAnimationFrame;

let loadCount = 0;

/**
 * Loads a fresh copy of the formulary for a page query. The module mounts itself on import.
 *
 * @param {string} search - Page query string, such as "?type=post".
 * @returns {Promise<object>} The mount root.
 */
async function loadFormulary(search) {
  const { root } = installDomDocument();
  document.querySelector = (selector) => (selector === "#formularyRoot" ? root : null);
  window.location.search = search;
  loadCount += 1;
  try {
    await loadAppModule(new URL(`./mountAgnosticFormulary.js?load=${loadCount}`, import.meta.url).href);
  } finally {
    window.location.search = "";
  }
  await nextTick();
  return root;
}

/**
 * Finds an element by id.
 *
 * @param {object} root - Mount root.
 * @param {string} id - Element id.
 * @returns {object | null} The element.
 */
function byId(root, id) {
  return findElement(root, (node) => node.id === id);
}

/**
 * Types a value into a field and waits for the render.
 *
 * @param {object} field - Input, textarea, or select.
 * @param {string} value - New value.
 * @param {string} [eventType] - DOM event the field listens to.
 * @returns {Promise<void>}
 */
async function typeInto(field, value, eventType = "input") {
  field.value = value;
  field.dispatchEvent(new MouseEvent(eventType, { bubbles: true }));
  await nextTick();
}

/**
 * Clicks Send and waits for the render.
 *
 * @param {object} root - Mount root.
 * @returns {Promise<void>}
 */
async function clickSend(root) {
  const sendButton = findElement(root, (node) => node.nodeName === "BUTTON" && node.textContent === "Send");
  sendButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await nextTick();
}

test("no type query shows the FAQ form with query autofill and its contact options", async () => {
  const root = await loadFormulary("?name=Ada&email=ada%40example.com");

  assert.match(root.textContent, /FAQ Formulary/);
  assert.equal(String(byId(root, "nameInput").value), "Ada");
  assert.equal(String(byId(root, "emailInput").value), "ada@example.com");
  assert.equal(byId(root, "emailInput").type, "email");
  assert.equal(String(byId(root, "questionInput").value), "");
  assert.equal(byId(root, "questionInput").getAttribute("placeholder"), "Type your question");
  const contactSelect = byId(root, "contactMethodInput");
  assert.equal(contactSelect.nodeName, "SELECT");
  assert.match(contactSelect.textContent, /WhatsApp/);
});

test("an FAQ submit with a missing answer keeps the form, and a complete one clears it", async () => {
  const root = await loadFormulary("");

  await typeInto(byId(root, "nameInput"), "  Ada  ");
  await typeInto(byId(root, "emailInput"), "ada@example.com");
  await typeInto(byId(root, "contactMethodInput"), "email", "change");
  await clickSend(root);
  assert.equal(String(byId(root, "nameInput").value), "  Ada  ");

  await typeInto(byId(root, "questionInput"), "Where is my order?");
  await clickSend(root);
  assert.equal(String(byId(root, "nameInput").value), "");
  assert.equal(String(byId(root, "questionInput").value), "");
});

test("the post form needs content but not an image URL", async () => {
  const root = await loadFormulary("?type=post");

  assert.match(root.textContent, /Create a new post/);
  const contentField = byId(root, "contentInput");
  assert.equal(contentField.nodeName, "TEXTAREA");
  assert.equal(byId(root, "imageUrlInput").type, "text");

  await typeInto(byId(root, "imageUrlInput"), "photo.png");
  await clickSend(root);
  assert.equal(String(byId(root, "imageUrlInput").value), "photo.png");

  await typeInto(byId(root, "contentInput"), "Hello world");
  await clickSend(root);
  assert.equal(String(byId(root, "contentInput").value), "");
  assert.equal(String(byId(root, "imageUrlInput").value), "");
});

test("an unknown type query falls back to the FAQ form", async () => {
  const root = await loadFormulary("?type=survey");

  assert.match(root.textContent, /FAQ Formulary/);
});
