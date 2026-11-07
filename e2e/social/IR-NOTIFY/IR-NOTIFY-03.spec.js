const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-03 - A like arrives in the open social inbox and raises a toast.

const API_BASE_URL = "http://localhost:4000/api";
const NOTICE_TITLE = "Post liked";
const NOTICE_MESSAGE = "Bruno Silva liked your post.";

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
  await page.getByLabel("Username or email").fill("carla.nguyen");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("a like arrives in the open inbox and raises a toast", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const streamResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/notifications\/stream\?shell=social(&|$)/.test(response.url()) &&
      response.ok(),
  );
  await signInThroughTheForm(page);
  await streamResponse;
  const bell = page.getByRole("button", { name: "Notifications" });
  await expect(bell).toBeVisible();
  await expect(page.locator(".notification-bell-badge")).toHaveCount(0);
  await bell.click();
  await page
    .locator(".notification-dropdown")
    .getByRole("button", { name: "See all" })
    .click();
  await expect(page).toHaveURL(/\/notifications$/);
  const inbox = page.locator(".notifications-page-container");
  await expect(
    inbox.getByText("No notifications in your inbox."),
  ).toBeVisible();
  const brunoToken = await login(page.request, "bruno.silva");
  const likeResponse = await page.request.post(
    `${API_BASE_URL}/posts/post-03/like`,
    { headers: { Authorization: `Bearer ${brunoToken}` } },
  );
  expect(likeResponse.ok()).toBeTruthy();
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: NOTICE_TITLE });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("role", "status");
  await expect(toast.getByText(NOTICE_MESSAGE)).toBeVisible();
  await expect(inbox.getByText(NOTICE_TITLE)).toBeVisible();
  await expect(inbox.getByText(NOTICE_MESSAGE)).toBeVisible();
  await expect(inbox.getByText("No notifications in your inbox.")).toHaveCount(
    0,
  );
  await expect(page.locator(".notification-bell-badge")).toHaveText("1");
  await expect(page).toHaveURL(/\/notifications$/);
});
