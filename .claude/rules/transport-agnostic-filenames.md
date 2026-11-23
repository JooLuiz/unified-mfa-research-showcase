---
description: File names in apps and packages must not name a communication method
alwaysApply: true
---

# Transport-agnostic filenames

This repo compares the same system with and without Event Mesh. A file under `apps/` or `packages/` is named for the feature it owns. HTTP, EventSource, SSE, `CustomEvent`, `postMessage`, WebSocket, and Event Mesh belong in the module body.

- Do not put these tokens in a new or renamed path: `stream`, `sse`, `eventsource`, `mesh`, `websocket`, `postmessage`, `customevent`, `http`, `fetch`, `transport`. Match them case-insensitively, including inside a longer name such as `EventStream` or `browserTransport`.
- `events`, `watch`, and `watcher` are allowed. They name the feature, not the channel.
- When a module needs a different channel on `main` and on a `mesh/*` branch, keep the same file name and change the implementation. See [branch-structure-parity.mdc](./branch-structure-parity.mdc).
- A name that already contains a banned token is existing debt. Do not copy it. The next edit that changes that module renames it, and its `*.test.js` twin, on both comparison branches in the same change. See [cross-branch-tests.mdc](./cross-branch-tests.mdc).

Reject: `createOrderStatusStreamSession.js`, `cartLiveEventsTransport.js`, `browserTransport.js`.

Keep: `createOrderStatusSession.js`, `cartLiveEvents.js`, `eventBus.js`.
