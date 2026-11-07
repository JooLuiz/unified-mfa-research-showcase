const fs = require("fs");
const path = require("path");
const { restoreMockData } = require("./support/reset-mock-data");
const snapshotDirectory = path.resolve(__dirname, ".snapshot");

async function globalTeardown() {
  restoreMockData();
  fs.rmSync(snapshotDirectory, { recursive: true, force: true });
}

module.exports = globalTeardown;
