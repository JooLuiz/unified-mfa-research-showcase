const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-IFRAME-02 - The new-post iframe delivers the post to the social shell.

const API_BASE_URL = "http://localhost:4000/api";
const POST_CONTENT = "Delivered from the post iframe.";

test.beforeEach(async ({ page }) => {
  restoreMockData();
  await page.addInitScript(() => {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        data.type !== "post:form-submitted"
      ) {
        return;
      }
      const stored = JSON.parse(
        sessionStorage.getItem("iframe-delivered-actions") || "[]",
      );
      stored.push({ type: data.type, payload: data.payload });
      sessionStorage.setItem(
        "iframe-delivered-actions",
        JSON.stringify(stored),
      );
    });
  });
});

test("the new post iframe delivers the post to the social shell", async ({
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
  const postFrame = page.frameLocator('iframe[title="Create new post"]');
  await postFrame.getByLabel("What do you want to share?").fill(POST_CONTENT);
  const postRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/api/posts"),
  );
  await postFrame.getByRole("button", { name: "Send" }).click();
  const sentRequest = await postRequest;
  const delivered = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("iframe-delivered-actions") || "[]"),
  );
  expect(delivered).toEqual([
    {
      type: "post:form-submitted",
      payload: { content: POST_CONTENT, imageUrl: "" },
    },
  ]);
  expect(sentRequest.frame()).toBe(page.mainFrame());
  expect(sentRequest.postDataJSON()).toEqual({
    content: POST_CONTENT,
    imageUrl: "",
    authorId: carla.user.id,
  });
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: "Post published" });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("role", "status");
  await expect(
    toast.getByText("Your post is now visible in the community feed."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/posts$/);
});
