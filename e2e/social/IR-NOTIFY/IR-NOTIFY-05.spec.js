const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-05 - Clicking a toast that has a saved notice and a link opens that page and marks the inbox row read.

const SOCIAL_ORIGIN = "http://localhost:4500";
const POST_ID = "post-03";
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
  await likerPage.goto(`/posts/${POST_ID}`, { waitUntil: "domcontentloaded" });
  await likerPage
    .locator(".single-post-card")
    .getByRole("button", { name: /^Like \(/ })
    .click();
  await expect(
    likerPage
      .locator(".single-post-card")
      .getByRole("button", { name: /^Liked \(/ }),
  ).toBeVisible();
  await likerContext.close();
}

test("clicking the like toast opens the post and marks the notice read", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page, "carla.nguyen");
  const bell = page.getByRole("button", { name: "Notifications" });
  await bell.click();
  await page
    .locator(".notification-dropdown")
    .getByRole("button", { name: "See all" })
    .click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(
    page.getByText("No notifications in your inbox."),
  ).toBeVisible();
  await likeCarlasPost(browser);
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: NOTICE_TITLE });
  await expect(toast).toBeVisible();
  await expect(toast.getByText(NOTICE_MESSAGE)).toBeVisible();
  await toast.click();
  await expect(page).toHaveURL(new RegExp(`/posts/${POST_ID}$`));
  await expect(async () => {
    await page.goto("/notifications", { waitUntil: "domcontentloaded" });
    const noticeRow = page
      .locator(".notification-item")
      .filter({ hasText: NOTICE_TITLE });
    await expect(noticeRow).toBeVisible();
    await expect(
      noticeRow.getByRole("button", { name: "Mark as read", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".notification-bell-badge")).toHaveCount(0);
  }).toPass();
});
