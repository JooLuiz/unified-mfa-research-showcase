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

async function signInAsAdmin(page) {
  await signIn(page, {
    username: "alice.parker",
    tokenKey: "admin-shell:auth-token",
    userKey: "admin-shell:auth-user",
  });
}

test.beforeEach(() => {
  restoreMockData();
});

test("a route change redraws the page without reloading the document", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();
  await markDocument(page);
  await page.getByRole("button", { name: "Orders" }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toHaveCount(0);
  await expectSameDocument(page);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "All Orders" })).toHaveCount(
    0,
  );
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
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expectSameDocument(page);
});

test("saving the profile redraws the account page without reloading the document", async ({
  page,
}) => {
  const updatedName = "Alice Navarro";
  await signInAsAdmin(page);
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Alice Parker");
  await markDocument(page);
  await page.getByLabel("Full name").fill(updatedName);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue(updatedName);
  await expect(page.getByRole("button", { name: updatedName })).toBeVisible();
  await expectSameDocument(page);
});
