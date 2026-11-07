const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");

// IR-NAV-01 - Re-render the current page after a route, session, or local data change.

async function markDocument(page) {
  await page.evaluate(() => {
    window.__shellDocumentMarker = "alive";
  });
}

async function expectSameDocument(page) {
  await expect
    .poll(() => page.evaluate(() => window.__shellDocumentMarker))
    .toBe("alive");
}

test.beforeEach(() => {
  restoreMockData();
});

test("a route change redraws the page without reloading the document", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Trending Posts" }),
  ).toBeVisible();
  await markDocument(page);
  await page.getByRole("button", { name: "Posts" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trending Posts" }),
  ).toHaveCount(0);
  await expectSameDocument(page);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Trending Posts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toHaveCount(0);
  await expectSameDocument(page);
});

test("a session change redraws the page without reloading the document", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
  await markDocument(page);
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trending Posts" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expectSameDocument(page);
});

test("publishing a post redraws the posts page without reloading the document", async ({
  page,
}) => {
  const postContent = "IR-NAV-01 shell redraw check";
  await signIn(page, {
    username: "bruno.silva",
    tokenKey: "social-media-shell:auth-token",
    userKey: "social-media-shell:auth-user",
  });
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await markDocument(page);
  const newPostFrame = page.frameLocator('iframe[title="Create new post"]');
  await newPostFrame.getByLabel("What do you want to share?").fill(postContent);
  await newPostFrame.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByText(postContent)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await expectSameDocument(page);
});
