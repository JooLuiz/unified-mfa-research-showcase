# Test support

Shared helpers for the branch-stable unit suite. This folder sits outside `apps/` and `packages/` so the same files exist on every comparison branch.

## createRecordingTransport.js

In-memory `{ publish, subscribe }` used by shared package contract tests. It records each published message and delivers it to subscribers for that topic and event. It does not talk to window events, `postMessage`, HTTP, or Event Mesh.

`package.json` in this folder sets `"type": "module"` so the helper stays ESM while the repo root stays CommonJS.

## installBrowserTestDoubles.js

In-memory `EventSource`, `sessionStorage`, and `fetch` for the stock, order-status, post-like, and session stream factories. Those factories do not take a `{ publish, subscribe }` transport; this double lets their tests run in Node and assert the SSE event names they listen for.

## mountVueComponent.js

`mountVueComponent(component, props)` mounts a Vue component and returns `{ root, state, unmount }`. Changing `state` re-renders the component. `mountVueComposable(composable, props)` runs a composable inside a probe component and returns `{ read, state, unmount }`. The module installs the fake document before it loads Vue, because Vue's DOM runtime reads `document` once when it loads.

## installCustomElements.js

Opt-in `customElements` registry and `HTMLElement` base class for tests of `customElements.define` modules. Call it after `installDomDocument()` and before importing the element module. Each constructed element is a fake DOM node with the element class prototype, so React `createRoot(this)` and Vue `mount(this)` render into it. `createCustomElement`, `connectElement`, and `disconnectElement` create an element and run its lifecycle callbacks. Shadow DOM is not modeled, so a Vue `defineCustomElement` element can be registered but not rendered.
