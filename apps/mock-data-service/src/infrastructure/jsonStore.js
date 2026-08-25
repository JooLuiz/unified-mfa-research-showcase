/**
 * Provides JSON file persistence for the mock data service.
 * Role: Owns all reads/writes of the data directory so route modules never touch fs paths.
 * Not in this file: Route handling, domain mapping, or server wiring (src/server.js).
 * Key dependencies: Node fs/promises; JSON files under the service's data directory.
 * See also: src/server.js.
 */

const fs = require("fs/promises");
const path = require("path");

/**
 * Creates a JSON file store bound to a data directory.
 *
 * @param {string} dataDirectory - Absolute path to the directory holding JSON data files.
 * @returns {{ readJsonFile: (fileName: string) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any> }} File store operations.
 */
function createJsonStore(dataDirectory) {
  async function readJsonFile(fileName) {
    const filePath = path.join(dataDirectory, fileName);
    const fileContent = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContent);
  }

  async function writeJsonFile(fileName, data) {
    const filePath = path.join(dataDirectory, fileName);
    const serializedData = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, `${serializedData}\n`, "utf8");
  }

  async function readJsonFileWithDefault(fileName, defaultValue) {
    try {
      return await readJsonFile(fileName);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return defaultValue;
      }
      throw error;
    }
  }

  return { readJsonFile, writeJsonFile, readJsonFileWithDefault };
}

module.exports = { createJsonStore };
