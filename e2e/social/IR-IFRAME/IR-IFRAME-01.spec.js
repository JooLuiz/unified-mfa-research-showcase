const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-IFRAME-01 - The new-post iframe adopts the height reported by its content.

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

test("the new post iframe matches its content height", async ({
  page,
  context,
}) => {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "carla.nguyen", password: "password123" },
  });
  const carla = await loginResponse.json();
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("social-media-shell:auth-token", token);
      localStorage.setItem(
        "social-media-shell:auth-user",
        JSON.stringify(user),
      );
    },
    [carla.token, carla.user],
  );
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await expect(page.locator('iframe[title="Create new post"]')).toBeVisible();
  await expect
    .poll(async () => readFrameFit(page, "Create new post"))
    .toMatchObject({
      frameId: "new-post-formulary",
      scrolling: "no",
      overflow: "hidden",
      matchesContent: true,
      showsAllContent: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => readFrameFit(page, "Create new post"))
    .toMatchObject({
      frameId: "new-post-formulary",
      scrolling: "no",
      overflow: "hidden",
      matchesContent: true,
      showsAllContent: true,
    });
});
