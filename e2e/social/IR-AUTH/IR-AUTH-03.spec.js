const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-03 - Update the current logged in user.

const API_BASE_URL = "http://localhost:4000/api";

test.beforeEach(() => {
  restoreMockData();
});

function headerAccountButton(page, name) {
  return page
    .locator("#headerMount")
    .getByRole("button", { name, exact: true });
}

test("reopening the account page shows the profile fetched from the server", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Full name")).toHaveValue("Bruno Silva");
  const storedToken = await page.evaluate(() =>
    localStorage.getItem("social-media-shell:auth-token"),
  );
  const profileUpdate = await page.request.put(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${storedToken}` },
    data: { fullName: "Bruno Navarro" },
  });
  expect(profileUpdate.ok()).toBeTruthy();
  const profileRequest = page.waitForResponse(
    (response) =>
      response.url().includes("/users/me") &&
      response.request().method() === "GET",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  expect((await profileRequest).ok()).toBeTruthy();
  await expect(page.getByLabel("Full name")).toHaveValue("Bruno Navarro");
  await expect(headerAccountButton(page, "Bruno Navarro")).toBeVisible();
});
