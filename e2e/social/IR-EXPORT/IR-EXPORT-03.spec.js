const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-EXPORT-03 - A CSV download the server rejects shows the error and does not save a file.

test.beforeEach(() => {
  restoreMockData();
});

function headerAccountButton(page, name) {
  return page
    .locator("#headerMount")
    .getByRole("button", { name, exact: true });
}

async function openCarlaAccount(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("carla.nguyen");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await headerAccountButton(page, "Carla Nguyen").click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Posts" })).toBeVisible();
}

async function abortPostExport(page) {
  await page.route("**/api/exports/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.abort();
  });
}

test("a rejected post export shows the error and does not download a file", async ({
  page,
}) => {
  const downloads = [];
  page.on("download", (download) => {
    downloads.push(download.suggestedFilename());
  });
  await openCarlaAccount(page);
  await abortPostExport(page);
  await page.getByRole("button", { name: "Export CSV" }).click();
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: "Post export failed" });
  await expect(toast).toBeVisible();
  await expect(
    toast.getByText("Your posts could not be exported. Please try again."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account$/);
  expect(downloads).toEqual([]);
});
