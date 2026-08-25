/**
 * Serializes tabular export data into RFC 4180-compatible CSV text.
 * Role: Owns CSV cell escaping and CRLF-delimited document construction for mock-service exports.
 * Not in this file: HTTP response headers, authorization, or resource-specific row mapping.
 * Key dependencies: None.
 * See also: src/routes/exportRoutes.js.
 */

/**
 * Escapes one CSV field according to RFC 4180-compatible rules.
 *
 * @param {unknown} value - Raw scalar value from an export row.
 * @returns {string} CSV-safe field value.
 */
function escapeCsvField(value) {
  const stringValue = value == null ? "" : String(value);
  if (!/[",\r\n]/.test(stringValue)) {
    return stringValue;
  }
  return `"${stringValue.replace(/"/g, '""')}"`;
}

/**
 * Builds a CRLF-delimited CSV document with a header row.
 *
 * @param {string[]} headers - Column names in output order.
 * @param {unknown[][]} rows - Row values in the same order as headers.
 * @returns {string} UTF-8 CSV content ending in CRLF.
 * @note Every value is escaped at this seam, keeping routes free of CSV syntax concerns.
 */
function serializeCsv(headers, rows) {
  const csvRows = [headers, ...rows].map((row) =>
    row.map(escapeCsvField).join(","),
  );
  return `${csvRows.join("\r\n")}\r\n`;
}

module.exports = { serializeCsv };