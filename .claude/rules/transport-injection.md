---
description: Clients take an injected transport and do not open fetch, EventSource, or Event Mesh themselves
alwaysApply: true
---

# Transport injection

Client modules in `packages/` and shell command modules in `apps/*/src/commands/` must accept a transport as their first argument. They must not import `event-mesh/mesh`, call `fetch`, construct `EventSource`, or read `window` events directly.

- The shell creates the transport in `src/events/eventBus.js` with `createShellTransport` and passes it to each client.
- On `main` the transport wraps `fetch` and `EventSource` in `packages/server-events`. On `mesh` the same path wraps the Event Mesh client.
- Tests use `createRecordingTransport` from `test/support/`.
- Shared command and stream URLs live in `packages/server-events/src/eventEndpoints.js`. Shell-only routes live in `apps/*/src/events/eventEndpoints.js`.
