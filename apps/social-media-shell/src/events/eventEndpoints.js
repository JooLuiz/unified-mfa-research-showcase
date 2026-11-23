/**
 * Social shell commands that are not shared with other shells.
 * Role: Maps the posts CSV export. Likes and session stay in the shared endpoint map.
 * Not in this file: Post-like commands (packages/server-events/src/eventEndpoints.js).
 * Key dependencies: @shared/server-events.
 * See also: src/events/eventBus.js; apps/mock-data-service/src/inbound/exportRequestHandler.js.
 *   On main this is an HTTP CSV route; this branch requests an export job through the gateway.
 */

import { bearerHeaders, downloadCsvFile } from "@shared/server-events";

const POSTS_EXPORT_FILE_NAME = "my-posts.csv";

/**
 * @returns {{ requests: object }} Shell endpoint map.
 */
function createSocialEndpoints() {
  return {
    requests: {
      "exports:csv": {
        publishTopic: "exports",
        publishEvent: "requested",
        acceptEvent: "completed",
        rejectEvent: "failed",
        toGatewayPayload(payload, requestId) {
          return { requestId, kind: payload.kind };
        },
        toOutcome(payload) {
          return payload.code ? { ok: false, code: payload.code } : { ok: true, jobId: payload.jobId };
        },
        async afterAccept(outcome, payload, { apiBaseUrl, authToken }) {
          if (!outcome.jobId || typeof document === "undefined") {
            return;
          }
          const response = await fetch(
            `${apiBaseUrl}/exports/${encodeURIComponent(outcome.jobId)}/download`,
            { headers: bearerHeaders(authToken) },
          );
          await downloadCsvFile(response, POSTS_EXPORT_FILE_NAME);
        },
      },
    },
  };
}

export { createSocialEndpoints };
