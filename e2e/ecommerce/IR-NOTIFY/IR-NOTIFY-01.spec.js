const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-01 - A local success toast stays on this store tab.

const API_BASE_URL = "http://localhost:4000/api";
const TOKEN_KEY = "ecommerce-shell:auth-token";
const SOCIAL_HOME = "http://localhost:4500/";
const ADMIN_LOGIN = "http://localhost:4600/login";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectInboxUnchanged(request, token) {
  for (const shell of ["ecommerce", "social", "admin"]) {
    const response = await request.get(
      `${API_BASE_URL}/notifications?shell=${shell}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const payload = await response.json();
    expect(payload.total).toBe(0);
  }
}

test("the signed-in toast stays on this tab", async ({ browser }) => {
  const storeContext = await browser.newContext();
  const socialContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const actor = await storeContext.newPage();
  const otherTab = await storeContext.newPage();
  const socialPage = await socialContext.newPage();
  const adminPage = await adminContext.newPage();
  try {
    await otherTab.goto("/", { waitUntil: "domcontentloaded" });
    await socialPage.goto(SOCIAL_HOME, { waitUntil: "domcontentloaded" });
    await adminPage.goto(ADMIN_LOGIN, { waitUntil: "domcontentloaded" });
    await expect(
      otherTab.getByRole("button", { name: "Log in" }),
    ).toBeVisible();
    await expect(
      socialPage.getByRole("button", { name: "Log in" }),
    ).toBeVisible();
    await expect(
      adminPage.getByRole("heading", { name: "Log in to MFE Lab" }),
    ).toBeVisible();
    await actor.goto("/login", { waitUntil: "domcontentloaded" });
    await signInThroughTheForm(actor);
    const toast = actor.getByRole("status").filter({ hasText: "Signed in" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Welcome back, Bruno Silva.");
    await expect(
      otherTab.getByRole("status").filter({ hasText: "Signed in" }),
    ).toHaveCount(0);
    await expect(
      socialPage.getByRole("status").filter({ hasText: "Signed in" }),
    ).toHaveCount(0);
    await expect(
      adminPage.getByRole("status").filter({ hasText: "Signed in" }),
    ).toHaveCount(0);
    const token = await actor.evaluate(
      (tokenKey) => localStorage.getItem(tokenKey),
      TOKEN_KEY,
    );
    await expectInboxUnchanged(actor.request, token);
  } finally {
    await storeContext.close();
    await socialContext.close();
    await adminContext.close();
  }
});
