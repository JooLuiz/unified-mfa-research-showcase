/**
 * Downloads the signed-in shopper's order history.
 * Role: Asks the shell transport for the orders export. The adapter saves the file.
 * Not in this file: Export UI (src/pages/accountPage.js).
 * Key dependencies: The shell event interface.
 * See also: src/pages/accountPage.js; src/events/eventEndpoints.js.
 */

/**
 * Requests the orders CSV download.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ kind: "orders" }} exportRequest - Export kind. Ecommerce maps orders to my-orders.csv.
 * @returns {Promise<{ ok: boolean }>} Whether a CSV file was downloaded.
 * @sideEffects Sends exports/csv. The adapter triggers the browser download.
 */
async function requestCsvExport(transport, { kind }) {
  return transport.request({
    topic: "exports",
    event: "csv",
    payload: { kind },
  });
}

export { requestCsvExport };
