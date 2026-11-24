/**
 * Verifies the catalog HTTP routes against an in-memory store.
 * Role: Asserts the filtered product list and the 500 response each catalog route sends when its data cannot be read.
 * Not in this file: Stock math (src/domain/stock.js) or cart routes.
 * Key dependencies: node:test; src/routes/catalogRoutes.js; test/invokeRouter.js.
 * See also: src/routes/cartRoutes.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCatalogRouter } = require("./catalogRoutes");
const { createMemoryJsonStore, invokeRouter } = require("../../test/invokeRouter");

const products = [
  { id: "p-01", name: "Blue Mug", price: 12, stock: 5, categoryId: "c-01" },
  { id: "p-02", name: "Amber Lamp", price: 40, stock: 2, categoryId: "c-02" },
  { id: "p-03", name: "Blue Lamp", price: 30, stock: 0, categoryId: "c-02" },
];

/**
 * Sends one GET through the catalog router with console.error silenced.
 *
 * @param {import("node:test").TestContext} testContext - Restores console.error after the test.
 * @param {Record<string, unknown>} files - Initial store files.
 * @param {string} path - Request path.
 * @returns {Promise<{ status: number, body: any }>} Response status and body.
 */
function getCatalog(testContext, files, path) {
  testContext.mock.method(console, "error", () => {});
  const store = createMemoryJsonStore(files);
  return invokeRouter(createCatalogRouter(store), { method: "GET", path });
}

test("GET /products filters by search and category and sorts by price", async (testContext) => {
  const response = await getCatalog(
    testContext,
    { "products.json": products, "carts.json": [] },
    "/products?search=lamp&categoryIds=c-02&sortBy=price-desc",
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 2);
  assert.deepEqual(
    response.body.items.map((product) => product.id),
    ["p-02", "p-03"],
  );
});

test("GET /products and /products/:productId return 500 when products cannot be read", async (testContext) => {
  const listResponse = await getCatalog(testContext, {}, "/products");
  const itemResponse = await getCatalog(testContext, {}, "/products/p-01");

  assert.equal(listResponse.status, 500);
  assert.deepEqual(listResponse.body, { message: "Unable to load products" });
  assert.equal(itemResponse.status, 500);
  assert.deepEqual(itemResponse.body, { message: "Unable to load product" });
});

test("GET /products and /products/:productId return 500 with details when products are malformed", async (testContext) => {
  const malformedFiles = { "products.json": {}, "carts.json": [] };
  const listResponse = await getCatalog(testContext, malformedFiles, "/products");
  const itemResponse = await getCatalog(testContext, malformedFiles, "/products/p-01");

  assert.equal(listResponse.status, 500);
  assert.equal(listResponse.body.message, "Unable to load products");
  assert.equal(typeof listResponse.body.details, "string");
  assert.equal(itemResponse.status, 500);
  assert.equal(itemResponse.body.message, "Unable to load product");
  assert.equal(typeof itemResponse.body.details, "string");
});

test("catalog lookups return 500 when their file cannot be read", async (testContext) => {
  const expectations = [
    ["/categories", "Unable to load categories"],
    ["/showcases", "Unable to load showcases"],
    ["/showcases/s-01", "Unable to load showcase"],
    ["/banners", "Unable to load banners"],
    ["/banners/b-01", "Unable to load banner"],
  ];

  for (const [path, message] of expectations) {
    const response = await getCatalog(testContext, {}, path);

    assert.equal(response.status, 500, path);
    assert.equal(response.body.message, message, path);
    assert.equal(typeof response.body.details, "string", path);
  }
});
