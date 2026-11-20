/**
 * Social shell HTTP routes that are not shared with other shells.
 * Role: Maps the posts CSV download. Live likes and session streams stay in the shared endpoint map.
 * Not in this file: Post-like commands (packages/server-events/src/eventEndpoints.js).
 * Key dependencies: @shared/server-events.
 * See also: src/events/eventBus.js.
 */

import { bearerHeaders, downloadCsvFile } from "@shared/server-events";

const csvExportByKind = {
  posts: { endpointPath: "/exports/posts.csv", fileName: "my-posts.csv" },
};

/**
 * @returns {{ requests: object }} Shell endpoint map.
 */
function createSocialEndpoints() {
  return {
    requests: {
      "exports:csv": {
        method: "GET",
        path(payload) {
          return csvExportByKind[payload.kind]?.endpointPath || "";
        },
        headers(authToken) {
          return bearerHeaders(authToken, { Accept: "text/csv" });
        },
        rejectWithoutAuth: true,
        missingAuthResult: { ok: false },
        networkResult() {
          return { ok: false };
        },
        fulfill(response, payload) {
          const fileName = csvExportByKind[payload.kind]?.fileName || "export.csv";
          return downloadCsvFile(response, fileName);
        },
      },
    },
  };
}

export { createSocialEndpoints };
