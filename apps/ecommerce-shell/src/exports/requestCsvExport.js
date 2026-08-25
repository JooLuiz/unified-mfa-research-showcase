/**
 * Downloads authenticated CSV exports for the ecommerce shell.
 * Role: Converts a successful direct HTTP CSV response into a browser download and returns only its outcome.
 * Not in this file: Export UI, notifications, or event-mesh completion handling.
 * Key dependencies: Mock data service and the browser Blob, URL, and document APIs.
 * See also: src/pages/accountPage.js.
 */

import { MOCK_API_BASE_URL } from "../utils/constants";

/**
 * Requests and downloads a CSV export from the mock data service.
 *
 * @param {{ endpointPath: string, fileName: string, authToken: string }} exportRequest - Endpoint path, download name, and current auth token.
 * @returns {Promise<{ ok: boolean }>} Whether a CSV file was successfully downloaded.
 * @sideEffects Performs an authenticated HTTP request and triggers a browser download.
 */
async function requestCsvExport({ endpointPath, fileName, authToken }) {
  let objectUrl = "";
  let downloadElement = null;

  try {
    const response = await fetch(`${MOCK_API_BASE_URL}${endpointPath}`, {
      headers: {
        Accept: "text/csv",
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `requestCsvExport - request failed: ${response.status} ${response.statusText}`,
      );
    }

    const csvBlob = await response.blob();
    objectUrl = URL.createObjectURL(csvBlob);
    downloadElement = document.createElement("a");
    downloadElement.href = objectUrl;
    downloadElement.download = fileName;
    downloadElement.style.display = "none";
    document.body.appendChild(downloadElement);
    downloadElement.click();
    return { ok: true };
  } catch (error) {
    console.warn("requestCsvExport - error");
    console.warn(error);
    return { ok: false };
  } finally {
    if (downloadElement) {
      downloadElement.remove();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export { requestCsvExport };