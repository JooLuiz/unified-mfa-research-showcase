/**
 * Matches the small set of selectors shell pages pass to querySelector and closest.
 * Role: Id, tag, class, attribute, and descendant matching for the page document stand-in.
 * Not in this file: Parsing markup or installing globals.
 * Key dependencies: None.
 * See also: test/support/pageElement.js.
 */

function unescapeCss(value) {
  return String(value).replace(/\\(.)/g, "$1");
}

/**
 * Finds the first descendant that matches a selector.
 *
 * @param {object} scope - Element whose descendants are searched.
 * @param {string} selector - Selector supported by this document.
 * @returns {object | null} Matching element.
 */
function findMatch(scope, selector) {
  for (const child of scope.childNodes || []) {
    if (child.nodeType === 1 && matchesSelector(child, selector)) {
      return child;
    }
    const nested = child.nodeType === 1 ? findMatch(child, selector) : null;
    if (nested) {
      return nested;
    }
  }
  return null;
}

/**
 * Reports whether an element matches a descendant selector.
 *
 * @param {object} element - Candidate element.
 * @param {string} selector - Selector supported by this document.
 * @returns {boolean} True when the element matches.
 */
function matchesSelector(element, selector) {
  const parts = selector.trim().split(/\s+/);
  if (!matchesCompound(element, parts[parts.length - 1])) {
    return false;
  }
  let ancestor = element.parentNode;
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    while (ancestor && (ancestor.nodeType !== 1 || !matchesCompound(ancestor, parts[index]))) {
      ancestor = ancestor.parentNode;
    }
    if (!ancestor || ancestor.nodeType !== 1) {
      return false;
    }
    ancestor = ancestor.parentNode;
  }
  return true;
}

/**
 * Reports whether an element matches one compound selector.
 *
 * @param {object} element - Candidate element.
 * @param {string} compound - Tag, id, class, and attribute pieces with no combinator.
 * @returns {boolean} True when every piece matches.
 */
function matchesCompound(element, compound) {
  if (!element || element.nodeType !== 1) {
    return false;
  }
  let remainder = compound;
  if (remainder.startsWith("#")) {
    return element.id === remainder.slice(1);
  }
  const tagMatch = remainder.match(/^[a-zA-Z][\w-]*/);
  if (tagMatch) {
    if (element.nodeName.toLowerCase() !== tagMatch[0].toLowerCase()) {
      return false;
    }
    remainder = remainder.slice(tagMatch[0].length);
  }
  while (remainder.startsWith(".")) {
    const classMatch = remainder.match(/^\.([\w-]+)/);
    if (!classMatch || !element.classList.contains(classMatch[1])) {
      return false;
    }
    remainder = remainder.slice(classMatch[0].length);
  }
  while (remainder.startsWith("[")) {
    const attributeMatch = remainder.match(
      /^\[([^\]=~|^$*]+)(?:([~|^$*]?=)(?:"([^"]*)"|'([^']*)'))?\]/,
    );
    if (!attributeMatch) {
      return false;
    }
    const actual = element.getAttribute(attributeMatch[1]);
    const expectedValue = attributeMatch[3] ?? attributeMatch[4];
    if (attributeMatch[2] === undefined) {
      if (actual === null) {
        return false;
      }
    } else if (actual !== unescapeCss(expectedValue)) {
      return false;
    }
    remainder = remainder.slice(attributeMatch[0].length);
  }
  return remainder === "";
}

export { findMatch, matchesSelector };
