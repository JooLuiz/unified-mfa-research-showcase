const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-05 - Signing out everywhere on admin ends that user's open sessions on the other shells.

const ECOMMERCE_SHELL_ORIGIN = "http://localhost:4200";
const SOCIAL_SHELL_ORIGIN = "http://localhost:4500";

test.beforeEach(() => {
  restoreMockData();
});

async function signIn(page, loginUrl) {
  const sessionStreamResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/auth/session-stream") &&
      response.status() === 200,
  );
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await sessionStreamResponse;
}

function readStoredSession(page, storagePrefix) {
  return page.evaluate((prefix) => {
    return {
      token: localStorage.getItem(`${prefix}:auth-token`),
      user: localStorage.getItem(`${prefix}:auth-user`),
    };
  }, storagePrefix);
}

test("signing out everywhere ends the same account on the other shells", async ({
  page,
  context,
}) => {
  const ecommercePage = await context.newPage();
  const socialPage = await context.newPage();
  await signIn(page, "/login");
  await signIn(ecommercePage, `${ECOMMERCE_SHELL_ORIGIN}/login`);
  await signIn(socialPage, `${SOCIAL_SHELL_ORIGIN}/login`);
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await ecommercePage.goto(`${ECOMMERCE_SHELL_ORIGIN}/products`, {
    waitUntil: "domcontentloaded",
  });
  await socialPage.goto(`${SOCIAL_SHELL_ORIGIN}/posts`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("button", { name: "Sign out everywhere" }),
  ).toBeVisible();
  await expect(
    ecommercePage.getByRole("heading", { name: "Filters" }),
  ).toBeVisible();
  await expect(
    socialPage.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await Promise.all([
    expect(page).toHaveURL(/http:\/\/localhost:4600\/login$/),
    expect(
      page.getByRole("heading", { name: "Log in to MFE Lab" }),
    ).toBeVisible(),
    expect(page.getByRole("button", { name: "Log in" })).toBeVisible(),
    expect(page.getByRole("button", { name: "Alice Parker" })).toHaveCount(0),
    expect(page.getByText("Your session ended on another device.")).toHaveCount(
      0,
    ),
    expect(
      ecommercePage.getByText("Your session ended on another device."),
    ).toBeVisible(),
    expect(ecommercePage).toHaveURL(/http:\/\/localhost:4200\/$/),
    expect(
      ecommercePage.locator('iframe[title="FAQ Formulary"]'),
    ).toBeVisible(),
    expect(ecommercePage.getByRole("button", { name: "Log in" })).toBeVisible(),
    expect(
      ecommercePage.getByRole("button", { name: "Alice Parker" }),
    ).toHaveCount(0),
    expect(
      socialPage.getByText("Your session ended on another device."),
    ).toBeVisible(),
    expect(socialPage).toHaveURL(/http:\/\/localhost:4500\/$/),
    expect(
      socialPage.getByRole("heading", { name: "Trending Posts" }),
    ).toBeVisible(),
    expect(socialPage.getByRole("button", { name: "Log in" })).toBeVisible(),
    expect(
      socialPage.getByRole("button", { name: "Alice Parker" }),
    ).toHaveCount(0),
  ]);
  const adminSession = await readStoredSession(page, "admin-shell");
  const ecommerceSession = await readStoredSession(
    ecommercePage,
    "ecommerce-shell",
  );
  const socialSession = await readStoredSession(
    socialPage,
    "social-media-shell",
  );
  expect(adminSession.token).toBeNull();
  expect(adminSession.user).toBeNull();
  expect(ecommerceSession.token).toBeNull();
  expect(ecommerceSession.user).toBeNull();
  expect(socialSession.token).toBeNull();
  expect(socialSession.user).toBeNull();
});
