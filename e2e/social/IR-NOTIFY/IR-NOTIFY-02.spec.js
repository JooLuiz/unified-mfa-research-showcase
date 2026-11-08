const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedLike } = require("../../support/seed-like");
const { seedNotification } = require("../../support/seed-notification");
const { seedOrder } = require("../../support/seed-order");

// IR-NOTIFY-02 - The social bell and inbox load the notices already saved for this user.

const API_BASE_URL = "http://localhost:4000/api";
const SEEDED_ORDER_ID = "order-e2e-placed";
const SAVED_MESSAGE = "Bruno Silva liked your post.";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("carla.nguyen");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("the bell and inbox load the saved social notice", async ({ page }) => {
  await seedLike("bruno.silva", "post-03");
  await seedNotification({
    username: "carla.nguyen",
    shell: "social",
    type: "Post liked",
    title: "Post liked",
    message: SAVED_MESSAGE,
    link: "/posts/post-03",
  });
  await seedOrder("carla.nguyen", {
    id: SEEDED_ORDER_ID,
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
  });
  await seedNotification({
    username: "carla.nguyen",
    shell: "ecommerce",
    type: "Order placed",
    title: "Order placed",
    message: `Your order #${SEEDED_ORDER_ID} has been placed successfully.`,
    link: `/order-details/${SEEDED_ORDER_ID}`,
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const inboxResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/notifications\?shell=social$/.test(response.url()) &&
      response.ok(),
  );
  await signInThroughTheForm(page);
  const inboxPayload = await (await inboxResponse).json();
  expect(inboxPayload.items.map((item) => item.title)).toEqual(["Post liked"]);
  const bell = page.getByRole("button", { name: "Notifications" });
  await expect(bell.locator(".notification-bell-badge")).toHaveText("1");
  await bell.click();
  const dropdown = page.locator(".notification-dropdown");
  await expect(dropdown.getByText("Post liked")).toBeVisible();
  await expect(dropdown.getByText(SAVED_MESSAGE)).toBeVisible();
  await expect(dropdown.getByText("Order placed")).toHaveCount(0);
  await dropdown.getByRole("button", { name: "See all" }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  const inbox = page.locator(".notifications-page-container");
  await expect(
    inbox.getByRole("heading", { name: "Notification Inbox" }),
  ).toBeVisible();
  await expect(inbox.getByText("Post liked")).toBeVisible();
  await expect(inbox.getByText(SAVED_MESSAGE)).toBeVisible();
  await expect(inbox.getByText("Order placed")).toHaveCount(0);
});
