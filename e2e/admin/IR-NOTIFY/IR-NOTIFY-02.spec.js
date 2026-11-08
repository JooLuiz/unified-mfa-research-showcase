const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-02 - The admin bell and inbox load the notices already saved for this user.

const API_BASE_URL = "http://localhost:4000/api";
const SAVED_MESSAGE = "Carla Nguyen published a new post.";
const STORE_MESSAGE = "Your order #order-mp4ve3gd-kb6od6 is now shipped.";

test.beforeEach(() => {
  restoreMockData();
});

async function login(request, username) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username, password: "password123" },
  });
  const payload = await response.json();
  return payload.token;
}

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("the bell and inbox load the saved admin notice", async ({ page }) => {
  const carlaToken = await login(page.request, "carla.nguyen");
  const postResponse = await page.request.post(`${API_BASE_URL}/posts`, {
    headers: { Authorization: `Bearer ${carlaToken}` },
    data: { content: "A saved post for the admin inbox." },
  });
  expect(postResponse.status()).toBe(201);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
  await page.goto("/order-details/order-mp4ve3gd-kb6od6", {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator(".order-details-shell")
    .getByRole("button", { name: "Ship" })
    .click();
  await expect(page.locator(".order-details-status")).toHaveText("Shipped");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const inboxResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/notifications\?shell=admin$/.test(response.url()) &&
      response.ok(),
  );
  await signInThroughTheForm(page);
  const inboxPayload = await (await inboxResponse).json();
  expect(inboxPayload.items.map((item) => item.title)).toEqual(["New post"]);
  const bell = page.getByRole("button", { name: "Notifications" });
  await expect(bell.locator(".notification-bell-badge")).toHaveText("1");
  await bell.click();
  const dropdown = page.locator(".notification-dropdown");
  await expect(dropdown.getByText("New post", { exact: true })).toBeVisible();
  await expect(dropdown.getByText(SAVED_MESSAGE)).toBeVisible();
  await expect(dropdown.getByText(STORE_MESSAGE)).toHaveCount(0);
  await dropdown.getByRole("button", { name: "See all" }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  const inbox = page.locator(".notifications-page-container");
  await expect(
    inbox.getByRole("heading", { name: "Notification Inbox" }),
  ).toBeVisible();
  await expect(inbox.getByText("New post", { exact: true })).toBeVisible();
  await expect(inbox.getByText(SAVED_MESSAGE)).toBeVisible();
  await expect(inbox.getByText(STORE_MESSAGE)).toHaveCount(0);
});
