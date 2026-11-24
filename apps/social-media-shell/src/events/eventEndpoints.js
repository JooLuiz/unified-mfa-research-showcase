/**
 * Social shell HTTP routes that are not shared with other shells.
 * Role: Maps post creation and the posts CSV download. Live likes and session streams stay in the shared endpoint map.
 * Not in this file: Post-like commands (packages/server-events/src/eventEndpoints.js).
 * Key dependencies: @shared/server-events.
 * See also: src/events/eventBus.js.
 */

import { bearerHeaders, downloadCsvFile, readJsonOutcome } from "@shared/server-events";

const csvExportByKind = {
  posts: { endpointPath: "/exports/posts.csv", fileName: "my-posts.csv" },
};

/**
 * @returns {{ requests: object }} Shell endpoint map.
 */
function createSocialEndpoints() {
  return {
    requests: {
      "community-posts:create": {
        method: "POST",
        path() {
          return "/posts";
        },
        headers(authToken) {
          return bearerHeaders(authToken, { "Content-Type": "application/json" });
        },
        body(payload) {
          return payload.post;
        },
        rejectWithoutAuth: true,
        missingAuthResult: { ok: false },
        networkResult() {
          return { ok: false };
        },
        parse(response) {
          return readJsonOutcome(response, "post");
        },
      },
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
