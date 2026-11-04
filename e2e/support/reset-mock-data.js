const fs = require("fs");
const path = require("path");
const sourceDirectory = path.resolve("apps/mock-data-service/data");
const snapshotDirectory = path.resolve("e2e/.snapshot");
function snapshotMockData() {
  fs.cpSync(sourceDirectory, snapshotDirectory, { recursive: true });
}
function restoreMockData() {
  fs.cpSync(snapshotDirectory, sourceDirectory, { recursive: true });
}
module.exports = { snapshotMockData, restoreMockData };
