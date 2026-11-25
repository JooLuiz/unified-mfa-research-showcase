/**
 * Calls one mock-data router against an in-memory JSON store.
 * Role: Gives route tests a memory store, a failing store, a silent event stream, and one HTTP round-trip.
 * Not in this file: Route behavior or SSE streams.
 * Key dependencies: express; node:http; src/domain/auth.js.
 * See also: src/routes/cartRoutes.test.js.
 */

const http = require("node:http");
const express = require("express");
const { buildAuthToken } = require("../src/domain/auth");

/**
 * Creates a JSON store whose files live in memory.
 *
 * @param {Record<string, unknown>} initialFiles - File name to stored JSON value.
 * @returns {{ files: Record<string, unknown>, readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }} In-memory store.
 */
function createMemoryJsonStore(initialFiles) {
  const files = structuredClone(initialFiles);
  return {
    files,
    async readJsonFile(fileName) {
      if (!Object.prototype.hasOwnProperty.call(files, fileName)) {
        const missingFileError = new Error(`Missing ${fileName}`);
        missingFileError.code = "ENOENT";
        throw missingFileError;
      }
      return structuredClone(files[fileName]);
    },
    async readJsonFileWithDefault(fileName, defaultValue) {
      try {
        return await this.readJsonFile(fileName);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          return structuredClone(defaultValue);
        }
        throw error;
      }
    },
    async writeJsonFile(fileName, data) {
      files[fileName] = structuredClone(data);
    },
  };
}

/**
 * Creates an in-memory JSON store that throws when reading or writing the named files.
 *
 * @param {Record<string, unknown>} initialFiles - File name to stored JSON value.
 * @param {{ failOnRead?: string[], failOnWrite?: string[] }} failures - Files whose read or write throws.
 * @returns {ReturnType<typeof createMemoryJsonStore>} Store whose `files` still holds the stored state.
 */
function createFailingJsonStore(initialFiles, { failOnRead = [], failOnWrite = [] } = {}) {
  const store = createMemoryJsonStore(initialFiles);
  return {
    ...store,
    async readJsonFile(fileName) {
      if (failOnRead.includes(fileName)) {
        throw new Error(`Cannot read ${fileName}`);
      }
      return store.readJsonFile(fileName);
    },
    async writeJsonFile(fileName, data) {
      if (failOnWrite.includes(fileName)) {
        throw new Error(`Cannot write ${fileName}`);
      }
      return store.writeJsonFile(fileName, data);
    },
  };
}

/**
 * Returns a stream whose methods do nothing.
 *
 * @returns {Record<string, () => void>} No-op broadcaster.
 */
function silentStream() {
  return {
    broadcastCartChanged() {},
    broadcastEvent() {},
    broadcastStockChanged() {},
    broadcastSessionRevoked() {},
    broadcastNotificationChanged() {},
    registerClient() {},
    writeCartChanged() {},
    rememberClient() {},
    forgetClient() {},
  };
}

/**
 * Builds the Authorization header for a user row.
 *
 * @param {{ id: string }} user - User the token names.
 * @returns {{ authorization: string }} Bearer header.
 */
function bearerFor(user) {
  return { authorization: `Bearer ${buildAuthToken(user)}` };
}

/**
 * Sends one request through a router and closes the server.
 *
 * @param {import("express").Router} router - Router under test.
 * @param {{ method: string, path: string, headers?: Record<string, string>, body?: unknown }} requestInput - Method, path, headers, and optional JSON body.
 * @returns {Promise<{ status: number, body: unknown }>} Status and parsed JSON body. An empty body is null.
 * @sideEffects Listens on 127.0.0.1 and closes that server before resolving.
 */
function invokeRouter(router, { method, path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const app = express();
    app.use(express.json());
    app.use(router);
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const payload = body === undefined ? null : JSON.stringify(body);
      const requestHeaders = { ...headers };
      if (payload) {
        requestHeaders["content-type"] = "application/json";
        requestHeaders["content-length"] = Buffer.byteLength(payload);
      }
      const request = http.request(
        { hostname: "127.0.0.1", port, path, method, headers: requestHeaders },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => {
            server.close(() => {
              const rawBody = Buffer.concat(chunks).toString("utf8");
              resolve({
                status: response.statusCode,
                body: rawBody ? JSON.parse(rawBody) : null,
              });
            });
          });
        },
      );
      request.on("error", (error) => {
        server.close(() => reject(error));
      });
      if (payload) {
        request.write(payload);
      }
      request.end();
    });
  });
}

module.exports = {
  bearerFor,
  createFailingJsonStore,
  createMemoryJsonStore,
  invokeRouter,
  silentStream,
};
