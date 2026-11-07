const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ACCOUNT-01 - Saving a name, gender, or address writes the user.

const USERNAME = "carla.nguyen";
const NEW_NAME = "Carla Nguyen Alves";
const NEW_GENDER = "female";
const NEW_STREET = "100 King Street";

test.beforeEach(() => {
  restoreMockData();
});

function headerAccountButton(page, name) {
  return page
    .locator("#headerMount")
    .getByRole("button", { name, exact: true });
}

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill(USERNAME);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("saving profile and address keeps the user after signing in again", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
  await headerAccountButton(page, "Carla Nguyen").click();
  await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
  await page.getByLabel("Full name").fill(NEW_NAME);
  await page.getByLabel("Gender").selectOption(NEW_GENDER);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Profile updated" }),
  ).toBeVisible();
  await expect(headerAccountButton(page, NEW_NAME)).toBeVisible();
  await page.getByLabel("Street").fill(NEW_STREET);
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Address updated" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("button", { name: "Log in" }).click();
  await signInThroughTheForm(page);
  await expect(headerAccountButton(page, NEW_NAME)).toBeVisible();
  await headerAccountButton(page, NEW_NAME).click();
  await expect(page.getByLabel("Full name")).toHaveValue(NEW_NAME);
  await expect(page.getByLabel("Gender")).toHaveValue(NEW_GENDER);
  await expect(page.getByLabel("Street")).toHaveValue(NEW_STREET);
});
