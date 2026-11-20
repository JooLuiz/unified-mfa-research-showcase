/**
 * Downloads the signed-in member's posts.
 * Role: Asks the shell transport for the posts export. The adapter saves the file.
 * Not in this file: Export UI (src/pages/accountPage.js).
 * Key dependencies: The shell event interface.
 * See also: src/pages/accountPage.js; src/events/eventEndpoints.js.
 */

/**
 * Requests the posts CSV download.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ kind: "posts" }} exportRequest - Export kind. The social shell maps posts to my-posts.csv.
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
