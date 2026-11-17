const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { setAuthorPostCount } = require("../../support/seed-empty-state");

// IR-SOCIAL-07 - The account states how many posts this person has, including none and one.

const CARLA_AUTHOR_ID = "u-03";

test.beforeEach(() => {
  restoreMockData();
});

function headerAccountButton(page) {
  return page
    .locator("#headerMount")
    .getByRole("button", { name: "Carla Nguyen", exact: true });
}

async function openCarlaAccount(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("carla.nguyen");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await headerAccountButton(page).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Posts" })).toBeVisible();
}

test("the account states how many posts this person has, including none and one", async ({
  page,
}) => {
  await setAuthorPostCount(CARLA_AUTHOR_ID, 0);
  await openCarlaAccount(page);
  await expect(page.getByText("You have not shared any posts yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);

  restoreMockData();
  await setAuthorPostCount(CARLA_AUTHOR_ID, 1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "My Posts" })).toBeVisible();
  await expect(page.getByText("1 post shared.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
});
