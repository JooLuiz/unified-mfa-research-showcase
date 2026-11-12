const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-03 - Update the current logged in user.

const API_BASE_URL = "http://localhost:4000/api";

test.beforeEach(() => {
  restoreMockData();
});

test("reopening the account page shows the profile fetched from the server", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Alice Parker" })).toBeVisible();
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Full name")).toHaveValue("Alice Parker");
  const storedToken = await page.evaluate(() =>
    localStorage.getItem("admin-shell:auth-token"),
  );
  const profileUpdate = await page.request.put(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${storedToken}` },
    data: { fullName: "Alice Navarro" },
  });
  expect(profileUpdate.ok()).toBeTruthy();
  const profileRequest = page.waitForResponse(
    (response) =>
      response.url().includes("/users/me") &&
      response.request().method() === "GET",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  expect((await profileRequest).ok()).toBeTruthy();
  await expect(page.getByLabel("Full name")).toHaveValue("Alice Navarro");
  await expect(
    page.getByRole("button", { name: "Alice Navarro" }),
  ).toBeVisible();
});
