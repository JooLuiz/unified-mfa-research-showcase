/**
 * Verifies the header custom element registration and the header a shopper sees for each shell.
 * Role: Locks single registration, the default shell, signed-in labels, the cart summary, the mobile
 *   menu, and render-before-connect and disconnect behavior.
 * Not in this file: Navigation and logout requests, which travel over the host's channel.
 * Key dependencies: node:test; react; src/header-element.js; scripts/test/jsxLoader.mjs;
 *   test/support/installDomDocument.js; test/support/installCustomElements.js.
 * See also: src/header-element.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { act } from "react";
import "../../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../../test/support/installDomDocument.js";
import {
  connectElement,
  createCustomElement,
  disconnectElement,
  installCustomElements,
} from "../../../../test/support/installCustomElements.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const jsxLoader = register(new URL("../../../../scripts/test/jsxLoader.mjs", import.meta.url), import.meta.url);
if (jsxLoader && typeof jsxLoader.then === "function") {
  await jsxLoader;
}

installDomDocument();
installCustomElements();
const { registerHeaderElement } = await loadAppModule(new URL("./header-element.js", import.meta.url).href);

const HEADER_NAME = "react-header-mfe";

/**
 * Creates, fills, and connects one header element.
 *
 * @param {object | undefined} state - Header state set before connecting.
 * @returns {Promise<object>} The connected header.
 */
async function mountHeader(state) {
  const { root } = installDomDocument();
  const header = createCustomElement(HEADER_NAME);
  if (state !== undefined) {
    header.state = state;
  }
  await act(async () => {
    connectElement(header, root);
  });
  return header;
}

/**
 * Clicks the first button whose text matches.
 *
 * @param {object} header - Mounted header.
 * @param {string} label - Button text.
 * @returns {Promise<void>}
 */
async function clickButton(header, label) {
  const button = findElement(header, (node) => node.nodeName === "BUTTON" && node.textContent === label);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

test("registering twice defines the header once", () => {
  registerHeaderElement();
  const firstClass = customElements.get(HEADER_NAME);
  registerHeaderElement();
  assert.equal(typeof firstClass, "function");
  assert.equal(customElements.get(HEADER_NAME), firstClass);
});

test("a header with no state shows the ecommerce shell for a guest with an empty cart", async () => {
  registerHeaderElement();
  const header = await mountHeader(undefined);
  try {
    assert.match(header.textContent, /E-commerce/);
    assert.match(header.textContent, /Products/);
    assert.match(header.textContent, /Log in/);
    assert.match(header.textContent, /Total: \$0\.00/);
    assert.equal(findElement(header, (node) => node.id === "notificationBellMount"), null);
  } finally {
    await act(async () => disconnectElement(header));
  }
});

test("a signed-in shopper without a name sees Account, the bell slot, and the cart summary", async () => {
  registerHeaderElement();
  const header = await mountHeader({ isAuthenticated: true, itemCount: 2, totalPrice: 12.5 });
  try {
    assert.match(header.textContent, /Account/);
    assert.match(header.textContent, /Log out/);
    assert.match(header.textContent, /Total: \$12\.50/);
    assert.notEqual(findElement(header, (node) => node.id === "notificationBellMount"), null);

    await act(async () => {
      header.state = { isAuthenticated: true, currentUserName: "Ada", appType: "ecommerce" };
    });
    assert.match(header.textContent, /Ada/);
  } finally {
    await act(async () => disconnectElement(header));
  }
});

test("social and admin headers show their own links and no cart", async () => {
  registerHeaderElement();
  const social = await mountHeader({ appType: "social" });
  try {
    assert.match(social.textContent, /Social Media/);
    assert.match(social.textContent, /Posts/);
    assert.doesNotMatch(social.textContent, /Total:/);
  } finally {
    await act(async () => disconnectElement(social));
  }

  const admin = await mountHeader({ appType: "admin", isAuthenticated: true, currentUserName: "Root" });
  try {
    assert.match(admin.textContent, /Admin/);
    assert.match(admin.textContent, /Orders/);
    assert.doesNotMatch(admin.textContent, /Total:/);
  } finally {
    await act(async () => disconnectElement(admin));
  }
});

test("the mobile menu opens with an Account link and closes on a wide resize", async () => {
  registerHeaderElement();
  const header = await mountHeader({ isAuthenticated: true, currentUserName: "Ada" });
  const originalWidth = window.innerWidth;
  try {
    await clickButton(header, "Menu");
    const menu = findElement(header, (node) => node.classList && node.classList.contains("mobile-menu-dropdown"));
    assert.match(menu.textContent, /Account/);

    window.innerWidth = 500;
    await act(async () => window.dispatchEvent(new Event("resize")));
    assert.notEqual(findElement(header, (node) => node.classList && node.classList.contains("mobile-menu-dropdown")), null);

    window.innerWidth = 1280;
    await act(async () => window.dispatchEvent(new Event("resize")));
    assert.equal(findElement(header, (node) => node.classList && node.classList.contains("mobile-menu-dropdown")), null);
  } finally {
    window.innerWidth = originalWidth;
    await act(async () => disconnectElement(header));
  }
});

test("state set before connecting renders on connect, and disconnecting before connecting does not throw", async () => {
  registerHeaderElement();
  const unconnected = createCustomElement(HEADER_NAME);
  unconnected.state = { appType: "social" };
  assert.equal(unconnected.textContent, "");
  assert.doesNotThrow(() => unconnected.disconnectedCallback());

  const { root } = installDomDocument();
  await act(async () => {
    connectElement(unconnected, root);
  });
  try {
    assert.match(unconnected.textContent, /Social Media/);
  } finally {
    await act(async () => disconnectElement(unconnected));
  }
});

test("the bell slot exists as soon as a signed-in header connects and is gone right after sign-out", async () => {
  registerHeaderElement();
  const { root } = installDomDocument();
  const header = createCustomElement(HEADER_NAME);
  header.state = { appType: "admin", isAuthenticated: true, currentUserName: "Alice" };
  try {
    await act(() => {
      connectElement(header, root);
      assert.notEqual(findElement(header, (node) => node.id === "notificationBellMount"), null);

      header.state = { appType: "admin", isAuthenticated: false };
      assert.equal(findElement(header, (node) => node.id === "notificationBellMount"), null);
    });
  } finally {
    await act(async () => disconnectElement(header));
  }
});
