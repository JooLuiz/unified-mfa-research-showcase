const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-EXPORT-03 - A CSV download the server rejects shows the error and does not save a file.

test.beforeEach(() => {
  restoreMockData();
});

async function openAliceAccount(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Alice Parker" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Orders" })).toBeVisible();
}

async function abortOrderExport(page) {
  await page.route("**/api/exports/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.abort();
  });
}

test("a rejected order export shows the error and does not download a file", async ({
  page,
}) => {
  const downloads = [];
  page.on("download", (download) => {
    downloads.push(download.suggestedFilename());
  });
  await openAliceAccount(page);
  await abortOrderExport(page);
  await page.getByRole("button", { name: "Export CSV" }).click();
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: "Order export failed" });
  await expect(toast).toBeVisible();
  await expect(
    toast.getByText(
      "Your order history could not be exported. Please try again.",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account$/);
  expect(downloads).toEqual([]);
});
