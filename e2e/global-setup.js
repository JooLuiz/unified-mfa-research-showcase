const { snapshotMockData } = require("./support/reset-mock-data");

async function globalSetup() {
  snapshotMockData();
}

module.exports = globalSetup;
