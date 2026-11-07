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
  const faqFrame = page.locator('iframe[title="FAQ Formulary"]');
  await expect(faqFrame).toBeVisible();
  await markDocument(page);
  await page.getByRole("button", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  await expect(faqFrame).toHaveCount(0);
  await expectSameDocument(page);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('iframe[title="FAQ Formulary"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Filters" })).toHaveCount(0);
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
  await expect(page).toHaveURL(/\/$/);
  await expectSameDocument(page);
});

test("removing the last checkout item redraws checkout without reloading the document", async ({
  page,
}) => {
  await signIn(page, {
    username: "bruno.silva",
    tokenKey: "ecommerce-shell:auth-token",
    userKey: "ecommerce-shell:auth-user",
  });
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const lampCard = page
    .locator("article")
    .filter({ hasText: "Minimalist Desk Lamp" });
  await lampCard.getByRole("button", { name: "Add to Cart" }).click();
  await page.getByRole("button", { name: "Total: $45.00" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
  await markDocument(page);
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  const emptyCartFrame = page.frameLocator('iframe[title="Checkout Empty"]');
  await expect(
    emptyCartFrame.getByRole("heading", {
      name: "There are no items in your cart",
    }),
  ).toBeVisible();
  await expectSameDocument(page);
});
