const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");

// IR-NAV-02 - A header click makes the ecommerce shell change route.

async function signInAsBruno(page) {
  await signIn(page, {
    username: "bruno.silva",
    tokenKey: "ecommerce-shell:auth-token",
    userKey: "ecommerce-shell:auth-user",
  });
}

async function expectRoute(page, url, headingName) {
  await expect(page).toHaveURL(url);
  if (headingName) {
    await expect(
      page.getByRole("heading", { name: headingName }),
    ).toBeVisible();
  }
}

test.beforeEach(() => {
  restoreMockData();
});

test("guest header links change the ecommerce route", async ({ page }) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "E-commerce" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('iframe[title="FAQ Formulary"]')).toBeVisible();
  await page.getByRole("button", { name: "Products" }).click();
  await expectRoute(page, /\/products$/, "Filters");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Promotions" }).click();
  await expectRoute(page, /\/promotions$/, "Upgrade Your Focus");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log in" }).click();
  await expectRoute(page, /\/login$/, "Log in to MFE Lab");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "0", exact: true }).click();
  await expectRoute(page, /\/login$/, "Log in to MFE Lab");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Total: $0.00" }).click();
  await expectRoute(page, /\/login$/, "Log in to MFE Lab");
});

test("signed-in header links change the ecommerce route", async ({ page }) => {
  await signInAsBruno(page);
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "E-commerce" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('iframe[title="FAQ Formulary"]')).toBeVisible();
  await page.getByRole("button", { name: "Products" }).click();
  await expectRoute(page, /\/products$/, "Filters");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Promotions" }).click();
  await expectRoute(page, /\/promotions$/, "Upgrade Your Focus");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Bruno Silva" }).click();
  await expectRoute(page, /\/account$/, "My Account");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "0", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  const emptyCartFrame = page.frameLocator('iframe[title="Checkout Empty"]');
  await expect(
    emptyCartFrame.getByRole("heading", {
      name: "There are no items in your cart",
    }),
  ).toBeVisible();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Total: $0.00" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.getByRole("button", { name: "See all" }).click();
  await expectRoute(page, /\/notifications$/, "Notification Inbox");
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test.describe("mobile header menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("menu links change the ecommerce route", async ({ page }) => {
    await signInAsBruno(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Products" }).click();
    await expectRoute(page, /\/products$/, "Filters");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Promotions" }).click();
    await expectRoute(page, /\/promotions$/, "Upgrade Your Focus");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Account" }).click();
    await expectRoute(page, /\/account$/, "My Account");
  });
});
