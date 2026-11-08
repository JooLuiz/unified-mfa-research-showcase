const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-04 - The admin posts table follows a new post and a like-count change without a reload.

const SOCIAL_ORIGIN = "http://localhost:4500";
const POST_TEXT = "Live update: the community feed should show this post.";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function signInOnSocial(page, username) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("the admin posts table follows a new post and a like change", async ({
  page,
  browser,
}) => {
  const carlaContext = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
  const brunoContext = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await signInThroughTheForm(page);
    await page.getByRole("button", { name: "Posts" }).click();
    await expect(page.getByRole("heading", { name: "All Posts" })).toBeVisible();
    await expect(page.locator("tr.admin-post-row").first()).toBeVisible();
    const carlaPage = await carlaContext.newPage();
    await signInOnSocial(carlaPage, "carla.nguyen");
    await carlaPage.getByRole("button", { name: "Posts" }).click();
    const postFrame = carlaPage.frameLocator('iframe[title="Create new post"]');
    await postFrame.getByLabel("What do you want to share?").fill(POST_TEXT);
    await postFrame.getByRole("button", { name: "Send" }).click();
    const newRow = page
      .locator("tr.admin-post-row")
      .filter({ hasText: POST_TEXT });
    await expect(newRow).toBeVisible();
    await expect(newRow.locator(".admin-cell-likes")).toHaveText("0");
    const brunoPage = await brunoContext.newPage();
    await signInOnSocial(brunoPage, "bruno.silva");
    await brunoPage.getByRole("button", { name: "Posts" }).click();
    await brunoPage
      .locator("article.post-card")
      .filter({ hasText: POST_TEXT })
      .getByRole("button", { name: "Like (0)" })
      .click();
    await expect(newRow.locator(".admin-cell-likes")).toHaveText("1");
    await expect(page).toHaveURL(/\/posts$/);
  } finally {
    await brunoContext.close();
    await carlaContext.close();
  }
});
