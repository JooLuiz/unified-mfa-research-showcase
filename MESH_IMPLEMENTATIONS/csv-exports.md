# CSV Exports over Event Mesh

Account-page **Export CSV** for My Orders (ecommerce) and My Posts (social) uses authenticated Event Mesh request/reply for job creation and HTTP for the CSV download.

## Why this split

Event Mesh is a pub/sub transport, not a file transport. CSV bytes, user ids, filenames, and download URLs stay on HTTP. Mesh carries export lifecycle signals only: `{ requestId, kind }` (and a public `code` on failure). Ownership is enforced again on download with the Bearer token.

Connection-level mesh authentication ensures the gateway assigns `userId` from a one-time ticket during WebSocket upgrade. Export requests never embed identity in the payload. See [mesh-authentication.md](./mesh-authentication.md) for the full ticket, gateway, and shell lifecycle.

## Flow

1. The user logs in. The shell fetches a one-time connection ticket from `POST /api/auth/connection-ticket` and opens an authenticated WebSocket to the gateway.
2. At bootstrap (or on login), the shell registers long-lived `exports.completed` / `exports.failed` listeners.
3. The user clicks **Export CSV**. The button shows `Preparing export...`.
4. The adapter calls `await mesh.whenConnected()`, then publishes `exports.requested` with `{ kind: "orders" | "posts" }` and `scope: "distributed"`.
5. The gateway subscriber reads `message.credential.userId`, creates an in-memory job, generates CSV with `setImmediate`, then replies with `gateway.reply()` — not a broadcast.
6. The shell receives the targeted reply, then GETs `/api/exports/:requestId/download` with the Bearer token.
7. Unknown or foreign jobs return `404`. Jobs that are not completed return `409`.
8. The adapter creates a Blob download and the account page shows the existing success or error toast.

```text
Login → POST /api/auth/connection-ticket → WebSocket ?ticket=...
Account page → mesh.publish exports.requested { kind }
Gateway handler → create job → generate CSV → gateway.reply(completed|failed)
Shell listener → targeted reply with requestId
Shell → GET /api/exports/:requestId/download → Blob download → publishNotification()
```

Authentication steps (ticket issue, WebSocket upgrade, session lifecycle) are documented in [mesh-authentication.md](./mesh-authentication.md).

## Event contract

| Direction | Topic | Event | Payload | Delivery |
| --- | --- | --- | --- | --- |
| Client → Gateway | `exports` | `requested` | `{ kind: "orders" \| "posts" }` | distributed publish |
| Gateway → Client | `exports` | `completed` | `{ requestId, kind }` | `gateway.reply()` |
| Gateway → Client | `exports` | `failed` | `{ requestId, kind, code }` | `gateway.reply()` |

`kind` is `"orders"` or `"posts"`. `userId` is never in event payloads — it comes from `message.credential` on the gateway.

## Client race handling

The first export used to fail when the WebSocket was not yet open. The adapters now call `mesh.whenConnected({ timeoutMs: 5000 })` before publishing the export request.

Replies are targeted to the requesting client via `gateway.reply()`, so shells do not need broadcast correlation or outcome buffering across users. The account page disables the export button during a single in-flight request.

## Files

| Area | Path |
| --- | --- |
| Mesh authentication (shared) | [mesh-authentication.md](./mesh-authentication.md) |
| Job store | `apps/mock-data-service/src/domain/exportJobs.js` |
| CSV processing | `apps/mock-data-service/src/domain/exportProcessing.js` |
| Gateway request handler | `apps/mock-data-service/src/event-mesh/exportRequestHandler.js` |
| Gateway reply helpers | `apps/mock-data-service/src/event-mesh/exportEvents.js` |
| HTTP download route | `apps/mock-data-service/src/routes/exportRoutes.js` |
| Ecommerce adapter | `apps/ecommerce-shell/src/exports/requestCsvExport.js` |
| Social adapter | `apps/social-media-shell/src/exports/requestCsvExport.js` |
| Account UI | `apps/ecommerce-shell/src/pages/accountPage.js`, `apps/social-media-shell/src/pages/accountPage.js` |

`@shared/notifications` renders toasts from a direct mesh subscription in each shell's notification center. Export result toasts use `publishNotification()` from the account page.

## What did not change

Admin shell has no export action but still connects to mesh with an authenticated ticket after login. Direct `GET /exports/orders.csv` and `GET /exports/posts.csv` are no longer the active path. `POST /api/exports` has been removed; job creation is mesh-only.
