const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-01 - A local success or error toast stays on this admin tab.

const API_BASE_URL = "http://localhost:4000/api";
const TOKEN_KEY = "admin-shell:auth-token";
const STORE_HOME = "http://localhost:4200/";
const SOCIAL_HOME = "http://localhost:4500/";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page, username) {
  await page.getByLabel("Username or email").fill(username);
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
  const adminContext = await browser.newContext();
  const storeContext = await browser.newContext();
  const socialContext = await browser.newContext();
  const actor = await adminContext.newPage();
  const otherTab = await adminContext.newPage();
  const storePage = await storeContext.newPage();
  const socialPage = await socialContext.newPage();
  try {
    await otherTab.goto("/login", { waitUntil: "domcontentloaded" });
    await storePage.goto(STORE_HOME, { waitUntil: "domcontentloaded" });
    await socialPage.goto(SOCIAL_HOME, { waitUntil: "domcontentloaded" });
    await expect(
      otherTab.getByRole("heading", { name: "Log in to MFE Lab" }),
    ).toBeVisible();
    await expect(
      storePage.getByRole("button", { name: "Log in" }),
    ).toBeVisible();
    await expect(
      socialPage.getByRole("button", { name: "Log in" }),
    ).toBeVisible();
    await actor.goto("/login", { waitUntil: "domcontentloaded" });
    await signInThroughTheForm(actor, "alice.parker");
    const toast = actor.getByRole("status").filter({ hasText: "Signed in" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Welcome back, Alice Parker.");
    await expect(
      otherTab.getByRole("status").filter({ hasText: "Signed in" }),
    ).toHaveCount(0);
    await expect(
      storePage.getByRole("status").filter({ hasText: "Signed in" }),
    ).toHaveCount(0);
    await expect(
      socialPage.getByRole("status").filter({ hasText: "Signed in" }),
    ).toHaveCount(0);
    const token = await actor.evaluate(
      (tokenKey) => localStorage.getItem(tokenKey),
      TOKEN_KEY,
    );
    await expectInboxUnchanged(actor.request, token);
  } finally {
    await adminContext.close();
    await storeContext.close();
    await socialContext.close();
  }
});

test("the access-denied toast stays on this tab", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const storeContext = await browser.newContext();
  const socialContext = await browser.newContext();
  const actor = await adminContext.newPage();
  const otherTab = await adminContext.newPage();
  const storePage = await storeContext.newPage();
  const socialPage = await socialContext.newPage();
  try {
    await otherTab.goto("/login", { waitUntil: "domcontentloaded" });
    await storePage.goto(STORE_HOME, { waitUntil: "domcontentloaded" });
    await socialPage.goto(SOCIAL_HOME, { waitUntil: "domcontentloaded" });
    await expect(
      otherTab.getByRole("heading", { name: "Log in to MFE Lab" }),
    ).toBeVisible();
    await actor.goto("/login", { waitUntil: "domcontentloaded" });
    await signInThroughTheForm(actor, "bruno.silva");
    const toast = actor.getByRole("alert").filter({ hasText: "Access denied" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(
      "This account does not have admin access.",
    );
    await expect(
      otherTab.getByRole("alert").filter({ hasText: "Access denied" }),
    ).toHaveCount(0);
    await expect(
      storePage.getByRole("alert").filter({ hasText: "Access denied" }),
    ).toHaveCount(0);
    await expect(
      socialPage.getByRole("alert").filter({ hasText: "Access denied" }),
    ).toHaveCount(0);
    const loginResponse = await actor.request.post(
      `${API_BASE_URL}/auth/login`,
      {
        data: { username: "bruno.silva", password: "password123" },
      },
    );
    const token = (await loginResponse.json()).token;
    await expectInboxUnchanged(actor.request, token);
  } finally {
    await adminContext.close();
    await storeContext.close();
    await socialContext.close();
  }
});
