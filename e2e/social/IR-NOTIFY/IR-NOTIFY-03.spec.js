const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-03 - A like arrives in the open social inbox and raises a toast.

const SOCIAL_ORIGIN = "http://localhost:4500";
const NOTICE_TITLE = "Post liked";
const NOTICE_MESSAGE = "Bruno Silva liked your post.";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page, username) {
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function likeCarlasPost(browser) {
  const likerContext = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
  const likerPage = await likerContext.newPage();
  await likerPage.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(likerPage, "bruno.silva");
  await likerPage.goto("/posts/post-03", { waitUntil: "domcontentloaded" });
  await likerPage
    .locator(".single-post-card")
    .getByRole("button", { name: /^Like \(/ })
    .click();
  await expect(
    likerPage.locator(".single-post-card").getByRole("button", { name: /^Liked \(/ }),
  ).toBeVisible();
  await likerContext.close();
}

test("a like arrives in the open inbox and raises a toast", async ({
  page,
  browser,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page, "carla.nguyen");
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
  await likeCarlasPost(browser);
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
