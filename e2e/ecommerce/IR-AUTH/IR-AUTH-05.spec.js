const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-05 - Signing out everywhere on ecommerce ends that user's open sessions on the other shells.

const SOCIAL_SHELL_ORIGIN = "http://localhost:4500";

const ADMIN_SHELL_ORIGIN = "http://localhost:4600";

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
  const socialPage = await context.newPage();
  const adminPage = await context.newPage();
  await signIn(page, "/login");
  await signIn(socialPage, `${SOCIAL_SHELL_ORIGIN}/login`);
  await signIn(adminPage, `${ADMIN_SHELL_ORIGIN}/login`);
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await socialPage.goto(`${SOCIAL_SHELL_ORIGIN}/posts`, {
    waitUntil: "domcontentloaded",
  });
  await adminPage.goto(`${ADMIN_SHELL_ORIGIN}/orders`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("button", { name: "Sign out everywhere" }),
  ).toBeVisible();
  await expect(
    socialPage.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await expect(
    adminPage.getByRole("heading", { name: "All Orders" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await Promise.all([
    expect(page).toHaveURL(/http:\/\/localhost:4200\/$/),
    expect(page.locator('iframe[title="FAQ Formulary"]')).toBeVisible(),
    expect(page.getByRole("button", { name: "Log in" })).toBeVisible(),
    expect(page.getByRole("button", { name: "Alice Parker" })).toHaveCount(0),
    expect(page.getByText("Your session ended on another device.")).toHaveCount(
      0,
    ),
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
    expect(
      adminPage.getByText("Your session ended on another device."),
    ).toBeVisible(),
    expect(adminPage).toHaveURL(/http:\/\/localhost:4600\/login$/),
    expect(
      adminPage.getByRole("heading", { name: "Log in to MFE Lab" }),
    ).toBeVisible(),
    expect(adminPage.getByRole("button", { name: "Log in" })).toBeVisible(),
    expect(adminPage.getByRole("button", { name: "Alice Parker" })).toHaveCount(
      0,
    ),
  ]);
  const ecommerceSession = await readStoredSession(page, "ecommerce-shell");
  const socialSession = await readStoredSession(
    socialPage,
    "social-media-shell",
  );
  const adminSession = await readStoredSession(adminPage, "admin-shell");
  expect(ecommerceSession.token).toBeNull();
  expect(ecommerceSession.user).toBeNull();
  expect(socialSession.token).toBeNull();
  expect(socialSession.user).toBeNull();
  expect(adminSession.token).toBeNull();
  expect(adminSession.user).toBeNull();
});
