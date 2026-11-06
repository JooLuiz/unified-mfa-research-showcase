/**
 * Verifies the in-memory lifecycle of an asynchronous CSV export job.
 * Role: Exercises create, lookup, completion, and failure without HTTP or Event Mesh.
 * Not in this file: CSV serialization or event-mesh publication.
 * Key dependencies: node:test; src/domain/exportJobs.js.
 * See also: src/domain/exportJobs.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  EXPORT_JOB_STATUSES,
  createExportJob,
  findExportJobForUser,
  markExportJobCompleted,
  markExportJobFailed,
} = require("./exportJobs");

test("createExportJob stores a queued job that only its owner can read", () => {
  const exportJob = createExportJob({
    userId: "u-01",
    kind: "posts",
    fileName: "my-posts.csv",
  });

  assert.equal(exportJob.status, EXPORT_JOB_STATUSES.queued);
  assert.equal(exportJob.csvContent, null);
  assert.equal(exportJob.errorCode, null);
  assert.equal(exportJob.fileName, "my-posts.csv");
  assert.equal(findExportJobForUser(exportJob.id, "u-01"), exportJob);
  assert.equal(findExportJobForUser(exportJob.id, "u-02"), null);
  assert.equal(findExportJobForUser("missing-export", "u-01"), null);
});

test("markExportJobCompleted stores the CSV and markExportJobFailed stores the error code", () => {
  const completedJob = createExportJob({
    userId: "u-01",
    kind: "orders",
    fileName: "my-orders.csv",
  });
  const failedJob = createExportJob({
    userId: "u-01",
    kind: "posts",
    fileName: "my-posts.csv",
  });

  const completed = markExportJobCompleted(completedJob.id, "postId,content\r\n");
  assert.equal(completed.status, EXPORT_JOB_STATUSES.completed);
  assert.equal(completed.csvContent, "postId,content\r\n");
  assert.equal(typeof completed.completedAt, "string");

  const failed = markExportJobFailed(failedJob.id, "export-failed");
  assert.equal(failed.status, EXPORT_JOB_STATUSES.failed);
  assert.equal(failed.errorCode, "export-failed");
  assert.equal(typeof failed.completedAt, "string");

  assert.equal(markExportJobCompleted("missing-export", "csv"), null);
  assert.equal(markExportJobFailed("missing-export", "export-failed"), null);
});
