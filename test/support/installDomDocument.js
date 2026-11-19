/**
 * Installs a small document so React views can mount during a unit test.
 * Role: Provides createElement, text, attributes, and bubbling clicks without a browser.
 * Not in this file: Assertions or a particular view.
 * Key dependencies: test/support/createDomNode.js.
 * See also: apps/notifications/src/NotificationItemRow.test.js.
 */

import { createNode, DOCUMENT_NODE, ELEMENT_NODE, TEXT_NODE } from "./createDomNode.js";

/**
 * Installs document, a bubbling click event, and a mount root.
 *
 * @returns {{ root: object }} Element that can host a React root.
 * @sideEffects Assigns global document and MouseEvent.
 */
function installDomDocument() {
  const documentNode = createNode(DOCUMENT_NODE, "#document", null);
  documentNode.ownerDocument = documentNode;
  documentNode.nodeType = DOCUMENT_NODE;

  documentNode.createElement = (tagName) => {
    const element = createNode(ELEMENT_NODE, String(tagName).toUpperCase(), documentNode);
    return element;
  };
  documentNode.createElementNS = (_namespace, tagName) => documentNode.createElement(tagName);
  documentNode.createTextNode = (text) => {
    const textNode = createNode(TEXT_NODE, "#text", documentNode);
    textNode.text = String(text);
    return textNode;
  };
  documentNode.querySelector = () => null;
  documentNode.querySelectorAll = () => [];
  documentNode.getElementById = () => null;
  documentNode.documentElement = documentNode.createElement("html");
  documentNode.body = documentNode.createElement("body");
  documentNode.activeElement = documentNode.body;
  documentNode.defaultView = globalThis.window;
  documentNode.documentElement.appendChild(documentNode.body);
  documentNode.appendChild(documentNode.documentElement);

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.document = documentNode;
  globalThis.HTMLElement = class HTMLElement {};
  globalThis.HTMLIFrameElement = class HTMLIFrameElement {};
  globalThis.Element = class Element {};
  globalThis.Node = class Node {};
  globalThis.window.HTMLElement = globalThis.HTMLElement;
  globalThis.window.HTMLIFrameElement = globalThis.HTMLIFrameElement;
  globalThis.window.Element = globalThis.Element;
  globalThis.window.Node = globalThis.Node;
  globalThis.window.document = documentNode;
  globalThis.MouseEvent = class MouseEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.bubbles = init.bubbles !== false;
      this.cancelable = Boolean(init.cancelable);
      this.defaultPrevented = false;
      this.button = init.button || 0;
      this.clientX = init.clientX || 0;
      this.clientY = init.clientY || 0;
      this.timeStamp = Date.now();
      this.target = null;
      this.currentTarget = null;
      this.propagationStopped = false;
    }

    preventDefault() {
      this.defaultPrevented = true;
    }

    stopPropagation() {
      this.propagationStopped = true;
    }
  };

  const root = documentNode.createElement("div");
  documentNode.body.appendChild(root);
  return { root };
}

/**
 * Finds the first node in a mounted tree that matches a predicate.
 *
 * @param {object} node - DOM node to search, including itself.
 * @param {(candidate: object) => boolean} predicate - Returns true for the wanted node.
 * @returns {object | null} The matching node, or null.
 */
function findElement(node, predicate) {
  if (predicate(node)) {
    return node;
  }
  for (const child of node.childNodes || []) {
    const match = findElement(child, predicate);
    if (match) {
      return match;
    }
  }
  return null;
}

export { findElement, installDomDocument };
