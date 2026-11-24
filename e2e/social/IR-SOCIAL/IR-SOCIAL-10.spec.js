const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-10 - A like from someone else updates the author's open account page without a reload.

const SOCIAL_ORIGIN = "http://localhost:4500";
const POST_TEXT =
  "Studio-quality recordings from my apartment thanks to the new microphone setup.";

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

test("the author's account page shows a new like from someone else", async ({
  page,
  browser,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page, "carla.nguyen");
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  const accountPost = page
    .locator("article.post-card")
    .filter({ hasText: POST_TEXT });
  await expect(
    accountPost.getByRole("button", { name: "Like (0)" }),
  ).toBeVisible();

  await likeCarlasPost(browser);

  await expect(
    accountPost.getByRole("button", { name: "Like (1)" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account$/);
});
