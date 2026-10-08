---
description: Forbid CustomEvent relays for mesh data on mesh/* branches
alwaysApply: true
---

# No CustomEvent relays on mesh branches

On any branch whose name starts with `mesh/`, do not add a `window.dispatchEvent(new CustomEvent(...))` /
`window.addEventListener` pair to relay a payload that already is, or is destined to become, an Event
Mesh message.

- `mesh.subscribe(topic, event, callback)` already supports any number of independent subscribers for the
  same topic/event (no scope filtering); a CustomEvent relay adds no capability mesh does not already provide.
- `event-mesh/mesh` is shared `singleton: true` in every app's `webpack.config.js`, so any micro frontend can
  call `mesh.subscribe` directly and reach the same client instance the gateway talks to.
- When several consumers need the same mesh-delivered payload, each one calls `mesh.subscribe` (directly, or
  through a shared `subscribeToX(listener)` wrapper) instead of fanning out through `window`.
- This does not restrict genuine native DOM events (`popstate`, `storage`, `click`, `resize`), or `main`, where
  `apps/ecommerce-shell/src/events/eventBus.js` legitimately wraps window events per
  [branch-structure-parity.mdc](./branch-structure-parity.mdc).

Fixed in this repo: `apps/ecommerce-shell/src/events/cartLiveEvents.js` and
`apps/admin-shell/src/events/adminLiveEvents.js` used to dispatch a `CustomEvent` after receiving a mesh
message and re-subscribe to it with `window.addEventListener`. Both now call `mesh.subscribe` directly from
every consumer.
