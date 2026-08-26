/**
 * Requests authenticated CSV exports for the social shell through event-mesh request/reply.
 * Role: Publishes export requests over mesh, awaits targeted replies, then downloads the CSV snapshot.
 * Not in this file: Export UI state, notifications, or mesh client configuration.
 * Key dependencies: event-mesh/mesh; mock data service; browser Blob, URL, and document APIs.
 * See also: src/pages/accountPage.js.
 */

import mesh from "event-mesh/mesh";
import { MOCK_API_BASE_URL } from "../utils/constants";

const EXPORT_TOPIC = "exports";
const EXPORT_REQUESTED_EVENT = "requested";
const EXPORT_COMPLETED_EVENT = "completed";
const EXPORT_FAILED_EVENT = "failed";
const EXPORT_TIMEOUT_MS = 15000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/** @type {((outcome: { ok: boolean, requestId?: string }) => void) | null} */
let pendingExportWaiter = null;
let exportListenersStarted = false;

function downloadCsvBlob(csvBlob, fileName) {
  const objectUrl = URL.createObjectURL(csvBlob);
  const downloadElement = document.createElement("a");
  downloadElement.href = objectUrl;
  downloadElement.download = fileName;
  downloadElement.style.display = "none";
  document.body.appendChild(downloadElement);
  downloadElement.click();
  downloadElement.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadExport(requestId, fileName, authToken) {
  const response = await fetch(
    `${MOCK_API_BASE_URL}/exports/${encodeURIComponent(requestId)}/download`,
    {
      headers: {
        Accept: "text/csv",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `downloadExport - request failed: ${response.status} ${response.statusText}`,
    );
  }

  const csvBlob = await response.blob();
  downloadCsvBlob(csvBlob, fileName);
}

function resolveExportOutcome(outcome) {
  if (!pendingExportWaiter) {
    return;
  }

  const resolveWaiter = pendingExportWaiter;
  pendingExportWaiter = null;
  resolveWaiter(outcome);
}

function handleExportCompleted(message) {
  const requestId = message.payload?.requestId;
  if (typeof requestId !== "string") {
    return;
  }
  resolveExportOutcome({ ok: true, requestId });
}

function handleExportFailed(message) {
  const requestId = message.payload?.requestId;
  resolveExportOutcome({
    ok: false,
    requestId: typeof requestId === "string" ? requestId : undefined,
  });
}

/**
 * Opens the mesh client and registers export completion listeners before any job is created.
 *
 * @returns {void}
 * @sideEffects Initializes the event-mesh singleton and subscribes to export events.
 */
function ensureCsvExportListeners() {
  if (exportListenersStarted) {
    return;
  }

  exportListenersStarted = true;
  mesh.subscribe(EXPORT_TOPIC, EXPORT_COMPLETED_EVENT, handleExportCompleted);
  mesh.subscribe(EXPORT_TOPIC, EXPORT_FAILED_EVENT, handleExportFailed);
}

/**
 * Clears export listener state so listeners can be re-registered after mesh reconnect.
 *
 * @returns {void}
 */
function resetCsvExportListeners() {
  exportListenersStarted = false;
  pendingExportWaiter = null;
}

function waitForNextExportOutcome() {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      pendingExportWaiter = null;
      resolve({ ok: false });
    }, EXPORT_TIMEOUT_MS);

    pendingExportWaiter = (outcome) => {
      window.clearTimeout(timeoutId);
      resolve(outcome);
    };
  });
}

/**
 * Requests an export job and downloads it after its mesh completion reply.
 *
 * @param {{ kind: "orders" | "posts", fileName: string, authToken: string }} exportRequest - Export kind, download name, and current auth token.
 * @returns {Promise<{ ok: boolean }>} Whether a CSV file was successfully downloaded.
 * @sideEffects Publishes a mesh export request, listens for a targeted reply, and triggers a browser download.
 */
async function requestCsvExport({ kind, fileName, authToken }) {
  try {
    ensureCsvExportListeners();
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });

    const exportOutcomePromise = waitForNextExportOutcome();

    mesh.publish({
      topic: EXPORT_TOPIC,
      event: EXPORT_REQUESTED_EVENT,
      payload: { kind },
      scope: "distributed",
    });

    const exportOutcome = await exportOutcomePromise;
    if (!exportOutcome.ok || !exportOutcome.requestId) {
      return { ok: false };
    }

    await downloadExport(exportOutcome.requestId, fileName, authToken);
    return { ok: true };
  } catch (error) {
    console.warn("requestCsvExport - error");
    console.warn(error);
    return { ok: false };
  }
}

export { ensureCsvExportListeners, resetCsvExportListeners, requestCsvExport };
