const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-08 - Adding or changing an item reserves stock. Cards and the product page show what is still available and stop there. A guest sees that count too.

const API_BASE_URL = "http://localhost:4000/api";
const LAMP = "Minimalist Desk Lamp";

test.beforeEach(() => {
  restoreMockData();
});

function lampCard(page) {
  return page.locator("article.card-shell", { hasText: LAMP });
}

function waitUntilWatchingLamp(page) {
  return page.waitForResponse((response) => {
    if (
      !response.url().includes("/stock/watching") ||
      response.request().method() !== "PUT"
    ) {
      return false;
    }
    return (response.request().postData() || "").includes("p-01");
  });
}

async function expectQuantityCapped(scope, inputSelector) {
  await expect(scope.getByText("2 available")).toBeVisible();
  await scope.getByRole("button", { name: "+", exact: true }).click();
  await expect(scope.locator(inputSelector)).toHaveValue("2");
  await expect(
    scope.getByRole("button", { name: "+", exact: true }),
  ).toBeDisabled();
}

test("a guest sees the available quantity and cannot pass it", async ({
  page,
}) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await expectQuantityCapped(lampCard(page), 'input[type="number"]');
  await page.goto("/product?productId=p-01", { waitUntil: "domcontentloaded" });
  const details = page.locator(".pdp-shell");
  await expect(details.getByRole("heading", { name: LAMP })).toBeVisible();
  await expectQuantityCapped(details, "input.pdp-quantity-value-input");
});

test("adding a lamp reserves one unit on the card a guest is watching", async ({
  page,
  browser,
}) => {
  const watcherContext = await browser.newContext();
  try {
    const watcher = await watcherContext.newPage();
    const watcherReady = waitUntilWatchingLamp(watcher);
    await watcher.goto("/products", { waitUntil: "domcontentloaded" });
    const card = lampCard(watcher);
    await expect(card.getByText("2 available")).toBeVisible();
    await watcherReady;
    const buyerReady = waitUntilWatchingLamp(page);
    await page.goto("/product?productId=p-01", {
      waitUntil: "domcontentloaded",
    });
    const details = page.locator(".pdp-shell");
    await expect(details.getByText("2 available")).toBeVisible();
    await buyerReady;
    await details.getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByRole("status")).toContainText(
      `${LAMP} was added to your cart.`,
    );
    await expect(details.getByText("1 available")).toBeVisible();
    await expect(
      details.getByRole("button", { name: "+", exact: true }),
    ).toBeDisabled();
    await expect(card.getByText("1 available")).toBeVisible();
    await expect(
      card.getByRole("button", { name: "+", exact: true }),
    ).toBeDisabled();
  } finally {
    await watcherContext.close();
  }
});

test("raising a checkout quantity reserves the remaining units", async ({
  page,
  context,
  browser,
}) => {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const bruno = await loginResponse.json();
  const saveResponse = await page.request.put(`${API_BASE_URL}/cart`, {
    headers: { Authorization: `Bearer ${bruno.token}` },
    data: {
      items: [{ productId: "p-01", quantity: 1 }],
      appliedCoupon: null,
    },
  });
  expect(saveResponse.ok()).toBeTruthy();
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [bruno.token, bruno.user],
  );
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    const guestReady = waitUntilWatchingLamp(guest);
    await guest.goto("/product?productId=p-01", {
      waitUntil: "domcontentloaded",
    });
    const details = guest.locator(".pdp-shell");
    await expect(details.getByText("1 available")).toBeVisible();
    await expect(
      details.getByRole("button", { name: "+", exact: true }),
    ).toBeDisabled();
    await guestReady;
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    const line = page.locator("article.checkout-item", { hasText: LAMP });
    await line.getByRole("button", { name: "+", exact: true }).click();
    await expect(line.locator("input.checkout-quantity-input")).toHaveValue(
      "2",
    );
    await expect(line.getByText("No more available")).toBeVisible();
    await expect(
      line.getByRole("button", { name: "+", exact: true }),
    ).toBeDisabled();
    await expect(details.getByText("Out of stock")).toBeVisible();
    await expect(
      details.getByRole("button", { name: "Add to Cart" }),
    ).toHaveCount(0);
  } finally {
    await guestContext.close();
  }
});
