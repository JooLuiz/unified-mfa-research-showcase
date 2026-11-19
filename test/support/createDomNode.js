/**
 * Builds one DOM node the React renderer can update in a unit test.
 * Role: Element, text, and document nodes with the methods React 18 calls while rendering.
 * Not in this file: Installing globals or searching a tree.
 * Key dependencies: None.
 * See also: test/support/installDomDocument.js.
 */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;

/**
 * Creates one DOM node the React renderer and the views can update.
 *
 * @param {number} nodeType - element, text, or document.
 * @param {string} nodeName - Tag name or "#text" / "#document".
 * @param {object | null} ownerDocument - Document that created the node.
 * @returns {object} Node with the methods React 18 calls while rendering.
 */
function createNode(nodeType, nodeName, ownerDocument) {
  const listenersByType = new Map();
  const attributes = new Map();
  const node = {
    nodeType,
    nodeName,
    ownerDocument,
    parentNode: null,
    childNodes: [],
    style: {},
    namespaceURI: "http://www.w3.org/1999/xhtml",
    attributes: [],
    text: "",
    className: "",
    id: "",
    value: "",
    disabled: false,
    type: "",
  };

  Object.defineProperty(node, "tagName", {
    get() {
      return node.nodeName;
    },
  });

  Object.defineProperty(node, "textContent", {
    get() {
      if (node.nodeType === TEXT_NODE) {
        return node.text;
      }
      return node.childNodes.map((child) => child.textContent).join("");
    },
    set(value) {
      node.childNodes = [];
      if (node.nodeType === TEXT_NODE) {
        node.text = String(value);
        return;
      }
      if (value !== "" && value != null) {
        const textNode = node.ownerDocument.createTextNode(String(value));
        node.appendChild(textNode);
      }
    },
  });

  Object.defineProperty(node, "firstChild", {
    get() {
      return node.childNodes[0] || null;
    },
  });

  Object.defineProperty(node, "lastChild", {
    get() {
      return node.childNodes[node.childNodes.length - 1] || null;
    },
  });

  Object.defineProperty(node, "nextSibling", {
    get() {
      if (!node.parentNode) {
        return null;
      }
      const index = node.parentNode.childNodes.indexOf(node);
      return node.parentNode.childNodes[index + 1] || null;
    },
  });

  Object.defineProperty(node, "previousSibling", {
    get() {
      if (!node.parentNode) {
        return null;
      }
      const index = node.parentNode.childNodes.indexOf(node);
      return node.parentNode.childNodes[index - 1] || null;
    },
  });

  node.appendChild = (child) => {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = node;
    node.childNodes.push(child);
    return child;
  };

  node.insertBefore = (child, reference) => {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = node;
    const index = reference ? node.childNodes.indexOf(reference) : -1;
    if (index < 0) {
      node.childNodes.push(child);
    } else {
      node.childNodes.splice(index, 0, child);
    }
    return child;
  };

  node.removeChild = (child) => {
    const index = node.childNodes.indexOf(child);
    if (index >= 0) {
      node.childNodes.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  };

  node.replaceChildren = (...children) => {
    node.childNodes.forEach((child) => {
      child.parentNode = null;
    });
    node.childNodes = [];
    children.forEach((child) => node.appendChild(child));
  };

  node.remove = () => {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  };

  node.setAttribute = (name, value) => {
    attributes.set(name, String(value));
    if (name === "class") {
      node.className = String(value);
    }
    if (name === "id") {
      node.id = String(value);
    }
    if (name === "type") {
      node.type = String(value);
    }
    if (name === "disabled") {
      node.disabled = true;
    }
  };

  node.getAttribute = (name) => (attributes.has(name) ? attributes.get(name) : null);

  node.removeAttribute = (name) => {
    attributes.delete(name);
    if (name === "disabled") {
      node.disabled = false;
    }
  };

  node.hasAttribute = (name) => attributes.has(name);

  node.addEventListener = (type, listener) => {
    const group = listenersByType.get(type) || new Set();
    group.add(listener);
    listenersByType.set(type, group);
  };

  node.removeEventListener = (type, listener) => {
    const group = listenersByType.get(type);
    if (group) {
      group.delete(listener);
    }
  };

  node.dispatchEvent = (event) => {
    event.target = event.target || node;
    const path = [];
    let current = node;
    while (current) {
      path.push(current);
      current = current.parentNode;
    }
    for (const targetNode of path) {
      event.currentTarget = targetNode;
      for (const listener of targetNode.listenersByType?.get(event.type) || []) {
        listener(event);
      }
      if (event.propagationStopped || event.bubbles === false) {
        break;
      }
    }
    return true;
  };

  node.contains = (other) => {
    let current = other;
    while (current) {
      if (current === node) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  };

  node.focus = () => {};
  node.blur = () => {};
  node.listenersByType = listenersByType;
  node.attributeMap = attributes;

  node.classList = {
    add(className) {
      const names = new Set(node.className.split(/\s+/).filter(Boolean));
      names.add(className);
      node.className = [...names].join(" ");
    },
    remove(className) {
      node.className = node.className
        .split(/\s+/)
        .filter((name) => name && name !== className)
        .join(" ");
    },
    contains(className) {
      return node.className.split(/\s+/).includes(className);
    },
  };

  return node;
}

export { createNode, ELEMENT_NODE, TEXT_NODE, DOCUMENT_NODE };
