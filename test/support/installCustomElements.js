/**
 * Adds a custom element registry and a fake-DOM-backed HTMLElement for unit tests.
 * Role: Opt-in support for tests of `customElements.define` modules, such as the header, footer,
 *   and product card elements. Each constructed element is a createDomNode node, so React
 *   `createRoot(this)` and Vue `mount(this)` can render into it.
 * Not in this file: Shadow DOM, attribute observation, or automatic upgrade of parsed markup.
 * Key dependencies: test/support/createDomNode.js; test/support/installDomDocument.js (call it first).
 * See also: apps/global-layout/header/src/header-element.test.js.
 */

import { createNode, DOCUMENT_NODE, ELEMENT_NODE } from "./createDomNode.js";

/**
 * Installs `customElements` and an `HTMLElement` base class on globalThis and window.
 * Call it after installDomDocument and before importing the element module.
 *
 * @returns {{ registry: Map<string, Function> }} The names defined so far, mapped to their classes.
 * @sideEffects Replaces globalThis.HTMLElement, window.HTMLElement, and globalThis.customElements.
 */
export function installCustomElements() {
  const registry = new Map();
  const tagNameByClass = new Map();

  class HTMLElement {
    constructor() {
      const tagName = tagNameByClass.get(new.target) || "custom-element";
      const node = createNode(ELEMENT_NODE, tagName.toUpperCase(), globalThis.document);
      Object.defineProperty(node, "isConnected", {
        get() {
          let current = node.parentNode;
          while (current) {
            if (current.nodeType === DOCUMENT_NODE) {
              return true;
            }
            current = current.parentNode;
          }
          return false;
        },
      });
      Object.setPrototypeOf(node, new.target.prototype);
      return node;
    }
  }

  const customElements = {
    define(name, elementClass) {
      if (registry.has(name)) {
        throw new Error(`Custom element "${name}" is already defined`);
      }
      registry.set(name, elementClass);
      tagNameByClass.set(elementClass, name);
    },
    get(name) {
      return registry.get(name);
    },
  };

  globalThis.HTMLElement = HTMLElement;
  globalThis.window.HTMLElement = HTMLElement;
  globalThis.customElements = customElements;
  globalThis.window.customElements = customElements;
  return { registry };
}

/**
 * Creates a defined custom element by name.
 *
 * @param {string} name - Registered element name.
 * @returns {object} New element instance.
 * @throws {Error} When the name is not defined.
 */
export function createCustomElement(name) {
  const elementClass = globalThis.customElements.get(name);
  if (!elementClass) {
    throw new Error(`Custom element "${name}" is not defined`);
  }
  return new elementClass();
}

/**
 * Appends an element to a parent and runs its connected callback, as the browser does.
 *
 * @param {object} element - Custom element instance.
 * @param {object} parent - Connected parent node, such as the root from installDomDocument.
 * @returns {object} The element.
 */
export function connectElement(element, parent) {
  parent.appendChild(element);
  element.connectedCallback?.();
  return element;
}

/**
 * Removes an element from its parent and runs its disconnected callback.
 *
 * @param {object} element - Custom element instance.
 * @returns {void}
 */
export function disconnectElement(element) {
  element.remove();
  element.disconnectedCallback?.();
}
