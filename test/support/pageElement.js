/**
 * Builds elements and parses the markup shell pages assign to innerHTML.
 * Role: Element, text, and fragment parsing for the page document stand-in.
 * Not in this file: Installing globals or recording remote mounts.
 * Key dependencies: test/support/pageSelector.js.
 * See also: test/support/createPageDocument.js.
 */

import { findMatch, matchesSelector } from "./pageSelector.js";

const VOID_TAGS = new Set(["br", "img", "input", "meta", "link", "hr", "source", "wbr"]);

/**
 * Creates one element that can hold parsed markup.
 *
 * @param {string} tagName - Tag name.
 * @param {object} documentNode - Owning document.
 * @returns {object} Element.
 */
function createElement(tagName, documentNode) {
  const listenersByType = new Map();
  const attributes = new Map();
  const element = {
    nodeType: 1,
    nodeName: String(tagName).toUpperCase(),
    ownerDocument: documentNode,
    parentNode: null,
    childNodes: [],
    style: {},
    className: "",
    id: "",
    type: "",
    value: "",
    disabled: false,
    text: "",
  };
  const datasetStore = {};
  element.dataset = new Proxy(datasetStore, {
    get(_target, key) {
      return datasetStore[key];
    },
    set(_target, key, value) {
      datasetStore[key] = String(value);
      const attributeName = `data-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      attributes.set(attributeName, String(value));
      return true;
    },
  });
  let hrefValue = "";
  Object.defineProperty(element, "href", {
    get() {
      return hrefValue;
    },
    set(value) {
      hrefValue = String(value);
      const parsed = new URL(hrefValue, window.location.href);
      element.pathname = parsed.pathname;
      element.search = parsed.search;
      element.hash = parsed.hash;
      element.host = parsed.host;
    },
  });

  Object.defineProperty(element, "tagName", {
    get() {
      return element.nodeName;
    },
  });
  Object.defineProperty(element, "textContent", {
    get() {
      return element.childNodes.map((child) => child.textContent).join("");
    },
    set(value) {
      element.childNodes = [];
      if (value !== "" && value != null) {
        element.appendChild(documentNode.createTextNode(String(value)));
      }
    },
  });
  Object.defineProperty(element, "innerHTML", {
    get() {
      return element.textContent;
    },
    set(value) {
      element.childNodes.forEach((child) => {
        child.parentNode = null;
      });
      element.childNodes = [];
      parseMarkup(String(value), documentNode).forEach((child) => element.appendChild(child));
    },
  });
  Object.defineProperty(element, "outerHTML", {
    get() {
      return element.innerHTML;
    },
    set(value) {
      const parent = element.parentNode;
      if (!parent) {
        return;
      }
      const nextSibling = element.nextSibling;
      parent.removeChild(element);
      parseMarkup(String(value), documentNode).forEach((child) => parent.insertBefore(child, nextSibling));
    },
  });
  Object.defineProperty(element, "isConnected", {
    get() {
      return Boolean(element.parentNode);
    },
  });
  Object.defineProperty(element, "nextSibling", {
    get() {
      if (!element.parentNode) {
        return null;
      }
      const index = element.parentNode.childNodes.indexOf(element);
      return element.parentNode.childNodes[index + 1] || null;
    },
  });

  element.appendChild = (child) => {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = element;
    element.childNodes.push(child);
    return child;
  };
  element.insertBefore = (child, reference) => {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = element;
    const index = reference ? element.childNodes.indexOf(reference) : -1;
    if (index < 0) {
      element.childNodes.push(child);
    } else {
      element.childNodes.splice(index, 0, child);
    }
    return child;
  };
  element.removeChild = (child) => {
    const index = element.childNodes.indexOf(child);
    if (index >= 0) {
      element.childNodes.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  };
  element.remove = () => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  };
  element.setAttribute = (name, value) => {
    attributes.set(name, String(value));
    if (name === "class") {
      element.className = String(value);
    }
    if (name === "id") {
      element.id = String(value);
    }
    if (name === "type") {
      element.type = String(value);
    }
    if (name === "disabled") {
      element.disabled = true;
    }
    if (name.startsWith("data-")) {
      const dataKey = name
        .slice(5)
        .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      datasetStore[dataKey] = String(value);
    }
  };
  element.getAttribute = (name) => (attributes.has(name) ? attributes.get(name) : null);
  element.addEventListener = (type, listener) => {
    const group = listenersByType.get(type) || new Set();
    group.add(listener);
    listenersByType.set(type, group);
  };
  element.removeEventListener = (type, listener) => {
    listenersByType.get(type)?.delete(listener);
  };
  element.dispatchEvent = (event) => {
    const clickEvent = event || { type: "click", bubbles: true };
    clickEvent.target = clickEvent.target || element;
    let current = element;
    while (current) {
      clickEvent.currentTarget = current;
      for (const listener of current.listenersByType?.get(clickEvent.type) || []) {
        listener(clickEvent);
      }
      if (clickEvent.bubbles === false) {
        break;
      }
      current = current.parentNode;
    }
    return true;
  };
  element.click = () => element.dispatchEvent({ type: "click", bubbles: true, target: element });
  element.closest = (selector) => {
    let current = element;
    while (current) {
      if (current.nodeType === 1 && matchesSelector(current, selector)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };
  element.contains = (other) => {
    let current = other;
    while (current) {
      if (current === element) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  };
  element.querySelector = (selector) => findMatch(element, selector);
  element.insertAdjacentHTML = (position, markup) => {
    const parsed = parseMarkup(String(markup), documentNode);
    if (position === "afterbegin") {
      const first = element.childNodes[0] || null;
      parsed.forEach((child) => element.insertBefore(child, first));
      return;
    }
    parsed.forEach((child) => element.appendChild(child));
  };
  element.classList = {
    contains(className) {
      return element.className.split(/\s+/).includes(className);
    },
  };
  element.listenersByType = listenersByType;
  return element;
}

function createTextNode(text, documentNode) {
  const decoded = String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"");
  return {
    nodeType: 3,
    nodeName: "#text",
    ownerDocument: documentNode,
    parentNode: null,
    childNodes: [],
    text: decoded,
    textContent: decoded,
  };
}

function parseMarkup(markup, documentNode) {
  const root = createElement("fragment", documentNode);
  const stack = [root];
  const pattern = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)>|<([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  for (const match of markup.matchAll(pattern)) {
    if (match[1]) {
      const closingTag = match[1].toLowerCase();
      while (stack.length > 1 && stack[stack.length - 1].nodeName.toLowerCase() !== closingTag) {
        stack.pop();
      }
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }
    if (match[2]) {
      const tagName = match[2].toLowerCase();
      const attributeSource = match[3].replace(/\/\s*$/, "");
      const element = createElement(tagName, documentNode);
      for (const attribute of attributeSource.matchAll(/([:@\w-]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g)) {
        if (attribute[1] === "/") {
          continue;
        }
        element.setAttribute(attribute[1], attribute[2] ?? attribute[3] ?? "");
      }
      stack[stack.length - 1].appendChild(element);
      const selfClosing = Boolean(match[4]) || /\/\s*$/.test(match[3]) || VOID_TAGS.has(tagName);
      if (!selfClosing) {
        stack.push(element);
      }
      continue;
    }
    if (match[5]) {
      stack[stack.length - 1].appendChild(createTextNode(match[5], documentNode));
    }
  }
  return [...root.childNodes];
}

export { createElement, createTextNode, parseMarkup };
