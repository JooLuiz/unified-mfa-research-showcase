/**
 * Generates unique identifiers for mock data records.
 * Role: Single source for the <prefix>-<timestamp>-<random> id format used by created resources.
 * Not in this file: Route handling or persistence.
 * Key dependencies: None.
 * See also: None.
 */

/**
 * Generates a unique identifier with a resource prefix.
 *
 * @param {string} prefix - Resource prefix such as "post", "faq", or "order".
 * @returns {string} Unique identifier.
 */
function generateIdentifier(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

module.exports = { generateIdentifier };
