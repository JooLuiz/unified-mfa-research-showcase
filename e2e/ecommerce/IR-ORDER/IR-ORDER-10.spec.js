const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-10 - A malformed order-details URL shows the missing-order message or the not-found page.

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("an order id that cannot be decoded shows the missing-order message", async ({
  page,
}) => {
  await signInThroughTheForm(page);
  await page.goto("/order-details/%E0%A4", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("No order id was provided.")).toBeVisible();
});

test("an order path with an extra segment shows the not-found page", async ({
  page,
}) => {
  await signInThroughTheForm(page);
  await page.goto("/order-details/abc/extra", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});
