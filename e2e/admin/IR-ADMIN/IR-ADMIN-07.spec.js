const { test, expect } = require("../../fixtures");
const fs = require("fs/promises");
const path = require("path");
const { restoreMockData } = require("../../support/reset-mock-data");
const { setStoredOrderStatus } = require("../../support/seed-empty-state");

// IR-ADMIN-07 - A post with no author and an order with no total still render, and a rejected ship stays placed.

const ORDER_ID = "order-mp4ve3gd-kb6od6";
const DATA_DIRECTORY = path.resolve("apps/mock-data-service/data");

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function seedMissingAuthorAndTotal() {
  const postsPath = path.join(DATA_DIRECTORY, "posts.json");
  const posts = JSON.parse(await fs.readFile(postsPath, "utf8"));
  posts.unshift({
    id: "post-orphan",
    authorId: "missing-user",
    content: "Orphan desk note",
    createdAt: "2026-01-01T00:00:00.000Z",
    likes: 0,
  });
  await fs.writeFile(postsPath, `${JSON.stringify(posts, null, 2)}\n`, "utf8");

  const ordersPath = path.join(DATA_DIRECTORY, "orders.json");
  const orders = JSON.parse(await fs.readFile(ordersPath, "utf8"));
  const matchingOrder = orders.find((orderRecord) => orderRecord.id === ORDER_ID);
  delete matchingOrder.totalAmount;
  await fs.writeFile(ordersPath, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
}

test("a missing author and total still render, and a rejected ship leaves the order placed", async ({
  page,
}) => {
  await seedMissingAuthorAndTotal();
  await signInThroughTheForm(page);

  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  const postRow = page.locator("tr.admin-post-row").filter({ hasText: "Orphan desk note" });
  await expect(postRow.getByText("Unknown author")).toBeVisible();

  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  const orderRow = page.locator("tr.admin-order-row").filter({ hasText: ORDER_ID });
  await expect(orderRow.getByText("$0.00")).toBeVisible();
  await expect(orderRow.getByText("Placed")).toBeVisible();

  await page.goto(`/order-details/${ORDER_ID}`, { waitUntil: "domcontentloaded" });
  const orderDetails = page.locator(".order-details-shell");
  await expect(orderDetails.locator(".order-details-status")).toHaveText("Placed");
  await setStoredOrderStatus(ORDER_ID, "delivered");
  await orderDetails.getByRole("button", { name: "Ship" }).click();
  await expect(
    page.locator(".notification-toast").filter({ hasText: "Status change rejected" }),
  ).toBeVisible();
  await expect(orderDetails.locator(".order-details-status")).toHaveText("Placed");
});
