# Test support

Shared helpers for the branch-stable unit suite. This folder sits outside `apps/` and `packages/` so the same files exist on every comparison branch.

## createRecordingTransport.js

In-memory `{ publish, subscribe }` used by shared package contract tests. It records each published message and delivers it to subscribers for that topic and event. It does not talk to window events, `postMessage`, HTTP, or Event Mesh.

`package.json` in this folder sets `"type": "module"` so the helper stays ESM while the repo root stays CommonJS.

## installBrowserTestDoubles.js

In-memory `EventSource`, `sessionStorage`, and `fetch` for the stock, order-status, post-like, and session stream factories. Those factories do not take a `{ publish, subscribe }` transport; this double lets their tests run in Node and assert the SSE event names they listen for.
