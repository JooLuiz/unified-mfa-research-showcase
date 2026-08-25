/**
 * Formatting helpers for the order details MFE.
 * Role: Owns currency, date, and shipping-address formatting shared by the view renderers.
 * Not in this file: Order loading (src/useOrderDetails.js) or VNode rendering (src/order-details-renderers.js).
 * Key dependencies: None.
 * See also: src/OrderDetailsView.js.
 */

/**
 * Formats a numeric amount as a USD price label.
 *
 * @param {number | string} amount - Raw amount.
 * @returns {string} Formatted price, or "$0.00" for non-finite input.
 */
function formatCurrencyValue(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return "$0.00";
  }
  return `$${numericAmount.toFixed(2)}`;
}

/**
 * Formats an ISO date string for display.
 *
 * @param {string} isoDateString - Raw ISO date string.
 * @returns {string} Localized date label, "-" for missing input, or the raw string when unparseable.
 */
function formatDateValue(isoDateString) {
  if (!isoDateString) {
    return "-";
  }
  const dateValue = new Date(isoDateString);
  if (Number.isNaN(dateValue.getTime())) {
    return isoDateString;
  }
  return dateValue.toLocaleString();
}

/**
 * Flattens a shipping address into display lines.
 *
 * @param {object} shippingAddress - Address record from the order.
 * @returns {string[]} Non-empty address lines.
 */
function buildAddressLines(shippingAddress) {
  if (!shippingAddress || typeof shippingAddress !== "object") {
    return [];
  }
  const cityRegionLine = [shippingAddress.city, shippingAddress.state]
    .filter(Boolean)
    .join(", ");
  const postalCountryLine = [shippingAddress.postalCode, shippingAddress.country]
    .filter(Boolean)
    .join(" - ");
  return [shippingAddress.street, cityRegionLine, postalCountryLine].filter(
    Boolean,
  );
}

export { formatCurrencyValue, formatDateValue, buildAddressLines };
