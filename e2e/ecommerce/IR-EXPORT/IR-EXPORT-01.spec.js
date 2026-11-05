const { test, expect } = require("@playwright/test");
const { readFileSync } = require("fs");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-EXPORT-01 - The store account downloads a CSV of the signed-in person's orders.

const API_BASE_URL = "http://localhost:4000/api";
const TOKEN_KEY = "ecommerce-shell:auth-token";
const SHIPPING = ["123 Maple Street", "Austin", "TX", "73301", "USA"];
const ORDER_EXPORT_HEADER = [
  "orderId",
  "placedAt",
  "productId",
  "productName",
  "quantity",
  "unitPrice",
  "subtotal",
  "discountAmount",
  "totalAmount",
  "couponCode",
  "shippingStreet",
  "shippingCity",
  "shippingState",
  "shippingPostalCode",
  "shippingCountry",
];

test.beforeEach(() => {
  restoreMockData();
});

function orderRow(orderId, placedAt, item, totals) {
  return [orderId, placedAt, ...item, ...totals, ...SHIPPING];
}

function expectedOrdersCsv() {
  const rows = [
    orderRow(
      "order-mp20d2w4-s59o9n",
      "2026-05-12T02:25:11.140Z",
      ["p-01", "Minimalist Desk Lamp", "1", "45"],
      ["455.49", "0", "455.49", ""],
    ),
    orderRow(
      "order-mp20d2w4-s59o9n",
      "2026-05-12T02:25:11.140Z",
      ["p-02", "Ergonomic Office Chair", "1", "289.99"],
      ["455.49", "0", "455.49", ""],
    ),
    orderRow(
      "order-mp20d2w4-s59o9n",
      "2026-05-12T02:25:11.140Z",
      ["p-03", "Mechanical Wireless Keyboard", "1", "120.5"],
      ["455.49", "0", "455.49", ""],
    ),
    orderRow(
      "order-mp4ve3gd-kb6od6",
      "2026-05-14T02:29:18.973Z",
      ["p-01", "Minimalist Desk Lamp", "1", "45"],
      ["784.99", "78.49900000000001", "706.491", "ten"],
    ),
    orderRow(
      "order-mp4ve3gd-kb6od6",
      "2026-05-14T02:29:18.973Z",
      ["p-02", "Ergonomic Office Chair", "1", "289.99"],
      ["784.99", "78.49900000000001", "706.491", "ten"],
    ),
    orderRow(
      "order-mp4ve3gd-kb6od6",
      "2026-05-14T02:29:18.973Z",
      ["p-07", "4K Ultra-Wide Monitor", "1", "450"],
      ["784.99", "78.49900000000001", "706.491", "ten"],
    ),
    orderRow(
      "order-mpq0wylv-j2mdx0",
      "2026-05-28T21:47:06.931Z",
      ["p-02", "Ergonomic Office Chair", "1", "289.99"],
      ["860.49", "0", "860.49", ""],
    ),
    orderRow(
      "order-mpq0wylv-j2mdx0",
      "2026-05-28T21:47:06.931Z",
      ["p-03", "Mechanical Wireless Keyboard", "1", "120.5"],
      ["860.49", "0", "860.49", ""],
    ),
    orderRow(
      "order-mpq0wylv-j2mdx0",
      "2026-05-28T21:47:06.931Z",
      ["p-07", "4K Ultra-Wide Monitor", "1", "450"],
      ["860.49", "0", "860.49", ""],
    ),
  ];
  return `${[ORDER_EXPORT_HEADER, ...rows].map((row) => row.join(",")).join("\r\n")}\r\n`;
}

async function placeBrunoOrder(request) {
  const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const loginPayload = await loginResponse.json();
  const orderResponse = await request.post(`${API_BASE_URL}/orders`, {
    headers: { Authorization: `Bearer ${loginPayload.token}` },
    data: {
      items: [
        {
          productId: "p-04",
          name: "Precision Optical Mouse",
          quantity: 1,
          unitPrice: 55,
        },
      ],
      subtotal: 55,
      discountAmount: 0,
      totalAmount: 55,
    },
  });
  expect(orderResponse.status()).toBe(201);
  const createdOrder = await orderResponse.json();
  return createdOrder.id;
}

async function openAliceAccount(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Alice Parker" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Orders" })).toBeVisible();
}

test("the account downloads a CSV of the signed-in person's orders", async ({
  page,
}) => {
  const brunoOrderId = await placeBrunoOrder(page.request);
  await openAliceAccount(page);
  const downloadPromise = page.waitForEvent("download");
  const exportResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().endsWith("/api/exports/orders.csv") &&
      response.ok(),
  );
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  const exportResponse = await exportResponsePromise;
  const token = await page.evaluate(
    (storageKey) => window.localStorage.getItem(storageKey),
    TOKEN_KEY,
  );
  expect(exportResponse.request().headers().authorization).toBe(
    `Bearer ${token}`,
  );
  expect(exportResponse.headers()["content-type"]).toContain("text/csv");
  expect(exportResponse.headers()["content-disposition"]).toContain(
    'filename="my-orders.csv"',
  );
  const expectedCsv = expectedOrdersCsv();
  expect(download.suggestedFilename()).toBe("my-orders.csv");
  const downloadedCsv = readFileSync(await download.path(), "utf8");
  expect(downloadedCsv).toBe(expectedCsv);
  expect(downloadedCsv.includes(brunoOrderId)).toBe(false);
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: "Orders exported" });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("role", "status");
  await expect(
    toast.getByText("Your order history has been downloaded as a CSV file."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account$/);
});
