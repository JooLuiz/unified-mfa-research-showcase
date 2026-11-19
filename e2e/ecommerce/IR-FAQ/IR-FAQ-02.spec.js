const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-FAQ-02 - A failed FAQ save still shows the submitted notice.

test.beforeEach(() => {
  restoreMockData();
});

test("a failed FAQ save still shows the submitted notice", async ({ page }) => {
  await page.route("**/api/faq", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const faqFrame = page.frameLocator('iframe[title="FAQ Formulary"]');
  await faqFrame.getByLabel("Name").fill("Guest Shopper");
  await faqFrame.getByLabel("Email").fill("guest.shopper@example.com");
  await faqFrame
    .getByLabel("How would you like to be contacted?")
    .selectOption("whatsapp");
  await faqFrame.getByLabel("Your question").fill("Do you ship the desk lamp?");
  await faqFrame.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("form submitted successfully")).toBeVisible();
});
