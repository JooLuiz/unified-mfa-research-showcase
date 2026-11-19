/**
 * Verifies the mock service health response.
 * Role: Locks the status the process reports before the shopper uses the store.
 * Not in this file: Catalog or cart responses.
 * Key dependencies: @playwright/test.
 * See also: apps/mock-data-service/src/server.js.
 */

const { test, expect } = require("@playwright/test");

test("the mock service answers a health check", async ({ request }) => {
  const response = await request.get("http://localhost:4000/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
