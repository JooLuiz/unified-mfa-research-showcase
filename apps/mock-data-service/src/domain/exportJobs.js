/**
 * Tracks asynchronous CSV export jobs for the mock data service.
 * Role: Owns the in-memory lifecycle from queued export request to downloadable result.
 * Not in this file: HTTP routing, CSV serialization, or event-mesh publication.
 * Key dependencies: src/domain/identifiers.js.
 * See also: Not called by any `main` HTTP route today — `main` downloads CSVs
 *   synchronously (see src/domain/exportProcessing.js). Kept here for
 *   branch-structure parity; the mesh branch's src/event-mesh/exportRequestHandler.js
 *   uses this module to track async export jobs.
 */

const { generateIdentifier } = require("./identifiers");

const EXPORT_JOB_STATUSES = Object.freeze({
  queued: "queued",
  completed: "completed",
  failed: "failed",
});

const exportJobsById = new Map();

/**
 * Creates a queued export job for an authenticated user.
 *
 * @param {{ userId: string, kind: "orders" | "posts", fileName: string }} jobInput - Export ownership and output metadata.
 * @returns {object} The queued export job.
 * @sideEffects Stores the job in the mock service process memory.
 */
function createExportJob({ userId, kind, fileName }) {
  const exportJob = {
    id: generateIdentifier("export"),
    userId,
    kind,
    status: EXPORT_JOB_STATUSES.queued,
    fileName,
    csvContent: null,
    errorCode: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  exportJobsById.set(exportJob.id, exportJob);
  return exportJob;
}

/**
 * Finds an export job only when it belongs to the authenticated user.
 *
 * @param {string} requestId - Opaque export job identifier.
 * @param {string} userId - Authenticated user identifier.
 * @returns {object | null} The export job, or null when unknown or foreign.
 */
function findExportJobForUser(requestId, userId) {
  const exportJob = exportJobsById.get(requestId);
  if (!exportJob || exportJob.userId !== userId) {
    return null;
  }
  return exportJob;
}

/**
 * Marks a queued job as completed and stores its generated CSV snapshot.
 *
 * @param {string} requestId - Export job identifier.
 * @param {string} csvContent - Serialized CSV attachment content.
 * @returns {object | null} The updated job, or null when unknown.
 * @sideEffects Mutates the in-memory job record.
 */
function markExportJobCompleted(requestId, csvContent) {
  const exportJob = exportJobsById.get(requestId);
  if (!exportJob) {
    return null;
  }

  exportJob.status = EXPORT_JOB_STATUSES.completed;
  exportJob.csvContent = csvContent;
  exportJob.completedAt = new Date().toISOString();
  return exportJob;
}

/**
 * Marks a queued job as failed with a public, non-sensitive error code.
 *
 * @param {string} requestId - Export job identifier.
 * @param {string} errorCode - Stable failure code safe to publish.
 * @returns {object | null} The updated job, or null when unknown.
 * @sideEffects Mutates the in-memory job record.
 */
function markExportJobFailed(requestId, errorCode) {
  const exportJob = exportJobsById.get(requestId);
  if (!exportJob) {
    return null;
  }

  exportJob.status = EXPORT_JOB_STATUSES.failed;
  exportJob.errorCode = errorCode;
  exportJob.completedAt = new Date().toISOString();
  return exportJob;
}

module.exports = {
  EXPORT_JOB_STATUSES,
  createExportJob,
  findExportJobForUser,
  markExportJobCompleted,
  markExportJobFailed,
};
