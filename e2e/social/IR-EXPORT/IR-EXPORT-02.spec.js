const { test, expect } = require("@playwright/test");
const { readFileSync } = require("fs");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-EXPORT-02 - The social account downloads a CSV of the signed-in person's posts.

const API_BASE_URL = "http://localhost:4000/api";
const POST_EXPORT_HEADER = [
  "postId",
  "createdAt",
  "content",
  "imageUrl",
  "likes",
  "comments",
];

test.beforeEach(() => {
  restoreMockData();
});

function escapeCsvField(value) {
  const stringValue = value == null ? "" : String(value);
  if (!/[",\r\n]/.test(stringValue)) {
    return stringValue;
  }
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function expectedPostsCsv() {
  const rows = [
    [
      "post-03",
      "2026-05-01T18:42:00Z",
      "Studio-quality recordings from my apartment thanks to the new microphone setup. Sample track coming soon.",
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800",
      "0",
      "31",
    ],
    [
      "post-06",
      "2026-05-05T07:48:00Z",
      "New noise cancelling headphones arrived. The world is finally quiet enough to think clearly.",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800",
      "0",
      "26",
    ],
    [
      "post-09",
      "2026-05-08T09:00:00Z",
      "The ultrawide monitor changed my life. I can finally see all 47 browser tabs at once.",
      "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=800",
      "0",
      "34",
    ],
    [
      "post-12",
      "2026-05-11T08:05:00Z",
      "Just finished a 5K run and got home to my smart speaker playing my recovery playlist automatically. The future is good.",
      "https://images.unsplash.com/photo-1539701938214-0d9736e1c16b?auto=format&fit=crop&w=800",
      "0",
      "11",
    ],
    [
      "post-15",
      "2026-05-14T17:20:00Z",
      "Designing in the new tablet. The pressure sensitivity is wild. Sketches feel alive now.",
      "https://images.unsplash.com/photo-1561070791-2526d30994b8?auto=format&fit=crop&w=800",
      "0",
      "28",
    ],
    [
      "post-18",
      "2026-05-17T20:30:00Z",
      "Movie night on the new projector. Nothing beats popcorn, a giant screen, and friends laughing too loud.",
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800",
      "0",
      "41",
    ],
    [
      "post-21",
      "2026-05-20T22:45:00Z",
      "Late night brainstorm session with the team. Whiteboards full, ideas flowing, snacks low.",
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800",
      "1",
      "24",
    ],
  ];
  return `${[POST_EXPORT_HEADER, ...rows]
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n")}\r\n`;
}

async function publishAlicePost(request) {
  const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "alice.parker", password: "password123" },
  });
  const loginPayload = await loginResponse.json();
  const postResponse = await request.post(`${API_BASE_URL}/posts`, {
    headers: { Authorization: `Bearer ${loginPayload.token}` },
    data: { content: "A post that stays out of Carla's export." },
  });
  expect(postResponse.status()).toBe(201);
  const createdPost = await postResponse.json();
  return createdPost.id;
}

function headerAccountButton(page, name) {
  return page
    .locator("#headerMount")
    .getByRole("button", { name, exact: true });
}

async function openCarlaAccount(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("carla.nguyen");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await headerAccountButton(page, "Carla Nguyen").click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Posts" })).toBeVisible();
  await expect(page.getByText("7 posts shared.")).toBeVisible();
}

test("the account downloads a CSV of the signed-in person's posts", async ({
  page,
}) => {
  const alicePostId = await publishAlicePost(page.request);
  await openCarlaAccount(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  const expectedCsv = expectedPostsCsv();
  expect(download.suggestedFilename()).toBe("my-posts.csv");
  const downloadedCsv = readFileSync(await download.path(), "utf8");
  expect(downloadedCsv).toBe(expectedCsv);
  expect(downloadedCsv.includes(alicePostId)).toBe(false);
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: "Posts exported" });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("role", "status");
  await expect(
    toast.getByText("Your posts have been downloaded as a CSV file."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account$/);
});
