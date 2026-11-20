/**
 * Saves a CSV response as a browser download.
 * Role: Turns a successful export response into a file save and returns only the outcome.
 * Not in this file: Which export kind maps to which path.
 * Key dependencies: Browser Blob, URL, and document.
 * See also: apps/ecommerce-shell/src/events/eventEndpoints.js; apps/social-media-shell/src/events/eventEndpoints.js.
 */

/**
 * Downloads the response body when the server accepted it.
 *
 * @param {Response} response - CSV HTTP response.
 * @param {string} fileName - Download name shown by the browser.
 * @returns {Promise<{ ok: boolean }>} Whether a file was saved.
 * @sideEffects Creates a temporary object URL and clicks a hidden anchor.
 */
async function downloadCsvFile(response, fileName) {
  if (!response.ok) {
    return { ok: false };
  }

  let objectUrl = "";
  let downloadElement = null;
  try {
    const csvBlob = await response.blob();
    objectUrl = URL.createObjectURL(csvBlob);
    downloadElement = document.createElement("a");
    downloadElement.href = objectUrl;
    downloadElement.download = fileName;
    downloadElement.style.display = "none";
    document.body.appendChild(downloadElement);
    downloadElement.click();
    return { ok: true };
  } finally {
    if (downloadElement) {
      downloadElement.remove();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export { downloadCsvFile };
