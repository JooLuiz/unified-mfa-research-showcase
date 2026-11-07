const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-FAQ-01 - The store home FAQ form sends name, email, contact method, and the question.

test.beforeEach(() => {
  restoreMockData();
});

test("the home FAQ form sends the question", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const faqFrame = page.frameLocator('iframe[title="FAQ Formulary"]');
  await expect(
    faqFrame.getByRole("heading", { name: "FAQ Formulary" }),
  ).toBeVisible();
  await faqFrame.getByLabel("Name").fill("Guest Shopper");
  await faqFrame.getByLabel("Email").fill("guest.shopper@example.com");
  await faqFrame
    .getByLabel("How would you like to be contacted?")
    .selectOption("whatsapp");
  await faqFrame.getByLabel("Your question").fill("Do you ship the desk lamp?");
  const faqPost = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().includes("/api/faq"),
  );
  await faqFrame.getByRole("button", { name: "Send" }).click();
  const sentRequest = await faqPost;
  expect(sentRequest.postDataJSON()).toEqual({
    name: "Guest Shopper",
    email: "guest.shopper@example.com",
    contactMethod: "whatsapp",
    question: "Do you ship the desk lamp?",
  });
  await expect(page.locator('iframe[title="FAQ Formulary"]')).toHaveCount(0);
  await expect(page.getByText("form submitted successfully")).toBeVisible();
});
