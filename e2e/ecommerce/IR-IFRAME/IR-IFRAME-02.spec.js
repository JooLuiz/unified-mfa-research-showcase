const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-IFRAME-02 - The FAQ form and the empty cart deliver their actions to the store shell.

const API_BASE_URL = "http://localhost:4000/api";
const FAQ_SUBMISSION = {
  name: "Guest Shopper",
  email: "guest.shopper@example.com",
  contactMethod: "whatsapp",
  question: "Do you ship the desk lamp?",
};

test.beforeEach(async ({ page }) => {
  restoreMockData();
  await page.addInitScript(() => {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string") {
        return;
      }
      const deliveredTypes = ["faq:form-submitted", "checkout:go-shopping"];
      if (!deliveredTypes.includes(data.type)) {
        return;
      }
      const stored = JSON.parse(
        sessionStorage.getItem("iframe-delivered-actions") || "[]",
      );
      stored.push({
        type: data.type,
        payload: Object.prototype.hasOwnProperty.call(data, "payload")
          ? data.payload
          : null,
      });
      sessionStorage.setItem(
        "iframe-delivered-actions",
        JSON.stringify(stored),
      );
    });
  });
});

async function deliveredActions(page) {
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("iframe-delivered-actions") || "[]"),
  );
}

test("the FAQ iframe delivers the question to the store", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const faqFrame = page.frameLocator('iframe[title="FAQ Formulary"]');
  await faqFrame.getByLabel("Name").fill(FAQ_SUBMISSION.name);
  await faqFrame.getByLabel("Email").fill(FAQ_SUBMISSION.email);
  await faqFrame
    .getByLabel("How would you like to be contacted?")
    .selectOption(FAQ_SUBMISSION.contactMethod);
  await faqFrame.getByLabel("Your question").fill(FAQ_SUBMISSION.question);
  const faqPost = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/api/faq"),
  );
  await faqFrame.getByRole("button", { name: "Send" }).click();
  const sentRequest = await faqPost;
  expect(await deliveredActions(page)).toEqual([
    { type: "faq:form-submitted", payload: FAQ_SUBMISSION },
  ]);
  expect(sentRequest.frame()).toBe(page.mainFrame());
  expect(sentRequest.postDataJSON()).toEqual(FAQ_SUBMISSION);
  await expect(page.locator('iframe[title="FAQ Formulary"]')).toHaveCount(0);
  await expect(page.getByText("form submitted successfully")).toBeVisible();
  await expect(
    page.getByText(
      "Latest iframe message: FAQ submitted by Guest Shopper (guest.shopper@example.com)",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("the empty cart iframe delivers the shopping action to the store", async ({
  page,
  context,
}) => {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const bruno = await loginResponse.json();
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [bruno.token, bruno.user],
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  const emptyCartFrame = page.frameLocator('iframe[title="Checkout Empty"]');
  await emptyCartFrame
    .getByRole("button", { name: "Go Back to Shopping" })
    .click();
  expect(await deliveredActions(page)).toEqual([
    { type: "checkout:go-shopping", payload: null },
  ]);
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  await expect(page.locator('iframe[title="Checkout Empty"]')).toHaveCount(0);
});
