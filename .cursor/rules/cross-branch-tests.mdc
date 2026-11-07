---
description: Unit and e2e tests must pass unchanged on main and mesh branches
alwaysApply: true
---

# Cross-branch tests

This repo compares the same system with and without Event Mesh. `npm test` and `npm run e2e` are one suite on `main` and on every `mesh/*` branch. A test that passes on only one of those branches is a broken test.

Assert behavior a caller or a shopper can observe. HTTP, `CustomEvent`, `postMessage`, and Event Mesh are transport.

- Keep `**/*.test.js` and `e2e/**/*.spec.js` identical across comparison branches. Do not fork, skip, or gate a test with the branch name, `process.env`, or a mesh-only import.
- Unit tests call the shared domain or package API and assert return values and stored state. `apps/mock-data-service/src/domain/exportJobs.test.js` checks job status, not how completion is published.
- E2E tests drive the UI and assert what the page shows. `e2e/ecommerce/IR-CART/IR-CART-01.spec.js` checks the cart count and confirmation text after Add to Cart.
- When a failure differs by branch, change the assertion to the shared outcome, or change both transports so that outcome matches. Leave the test file shared.
- A transport-only module may have a test only when that same test file exists and passes on both branches. Otherwise cover the shared contract it calls, such as `apps/mock-data-service/src/domain/orderProcessing.js`.

```js
// Reject: asserts the mesh subscription used on one branch.
expect(meshSubscribeCalls).toEqual([["cart", "item-added"]]);

// Keep: asserts the cart the shopper sees on every branch.
await expect(page.locator(".cart-item-count")).toHaveText("2");
```
