const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-IFRAME-01 - The FAQ and empty-cart iframes adopt the height reported by their content.

const API_BASE_URL = "http://localhost:4000/api";

test.beforeEach(() => {
  restoreMockData();
});

async function readFrameFit(page, iframeTitle) {
  const iframe = page.locator(`iframe[title="${iframeTitle}"]`);
  const frame = page.frameLocator(`iframe[title="${iframeTitle}"]`);
  const contentHeight = await frame
    .locator("body")
    .evaluate((body) =>
      Math.max(document.documentElement.scrollHeight, body.scrollHeight),
    );
  const host = await iframe.evaluate((element) => ({
    styleHeight: Number.parseInt(element.style.height, 10),
    renderedHeight: Math.round(element.getBoundingClientRect().height),
    scrolling: element.getAttribute("scrolling"),
    frameId: element.getAttribute("data-frame-id"),
  }));
  const inner = await frame.locator("html").evaluate((htmlElement) => ({
    clientHeight: htmlElement.clientHeight,
    scrollHeight: htmlElement.scrollHeight,
  }));
  const overflow = await frame
    .locator("body")
    .evaluate((body) => getComputedStyle(body).overflow);
  const expectedHeight = Math.max(contentHeight, 80);
  return {
    ...host,
    overflow,
    matchesContent:
      host.styleHeight === expectedHeight &&
      host.renderedHeight === expectedHeight,
    showsAllContent: inner.clientHeight >= contentHeight,
  };
}

async function expectFrameFitsContent(page, iframeTitle, frameId) {
  await expect
    .poll(async () => readFrameFit(page, iframeTitle))
    .toMatchObject({
      frameId,
      scrolling: "no",
      overflow: "hidden",
      matchesContent: true,
      showsAllContent: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => readFrameFit(page, iframeTitle))
    .toMatchObject({
      frameId,
      scrolling: "no",
      overflow: "hidden",
      matchesContent: true,
      showsAllContent: true,
    });
}

test("the FAQ iframe matches its content height", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('iframe[title="FAQ Formulary"]')).toBeVisible();
  await expectFrameFitsContent(page, "FAQ Formulary", "faq-formulary");
});

test("the empty cart iframe matches its content height", async ({
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
  await expect(page.locator('iframe[title="Checkout Empty"]')).toBeVisible();
  await expectFrameFitsContent(page, "Checkout Empty", "checkout-empty");
});
