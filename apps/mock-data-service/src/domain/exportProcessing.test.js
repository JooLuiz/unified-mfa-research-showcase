/**
 * Verifies CSV row mapping for the signed-in user's orders and posts.
 * Role: Exercises buildExportCsv with an in-memory JSON store.
 * Not in this file: HTTP attachment headers or async export jobs.
 * Key dependencies: node:test; src/domain/exportProcessing.js.
 * See also: src/domain/exportProcessing.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildExportCsv } = require("./exportProcessing");

/**
 * Creates a JSON store whose files live in memory.
 *
 * @param {Record<string, unknown>} initialFiles - File name to stored JSON value.
 * @returns {{ readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void>, files: Record<string, unknown> }} In-memory store.
 */
function createMemoryJsonStore(initialFiles) {
  const files = structuredClone(initialFiles);
  return {
    files,
    async readJsonFile(fileName) {
      if (!Object.prototype.hasOwnProperty.call(files, fileName)) {
        const missingFileError = new Error(`Missing ${fileName}`);
        missingFileError.code = "ENOENT";
        throw missingFileError;
      }
      return structuredClone(files[fileName]);
    },
    async readJsonFileWithDefault(fileName, defaultValue) {
      try {
        return await this.readJsonFile(fileName);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          return structuredClone(defaultValue);
        }
        throw error;
      }
    },
    async writeJsonFile(fileName, data) {
      files[fileName] = structuredClone(data);
    },
  };
}

function csvLines(csvContent) {
  return csvContent.split("\r\n").filter((line) => line.length > 0);
}

test("buildExportCsv writes one order row per item and skips other users", async () => {
  const jsonStore = createMemoryJsonStore({
    "orders.json": [
      {
        id: "order-01",
        userId: "u-01",
        placedAt: "2026-05-01T12:00:00.000Z",
        items: [{ productId: "p-01", name: "Desk Lamp", quantity: 2, unitPrice: 45 }],
        subtotal: 90,
        discountAmount: 10,
        totalAmount: 80,
        appliedCoupon: { code: "SAVE10" },
        shippingAddress: {
          street: "Av. Paulista 1000",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310-100",
          country: "Brazil",
        },
      },
      { id: "order-02", userId: "u-02", placedAt: "2026-05-02T12:00:00.000Z", items: [] },
    ],
  });

  const csvContent = await buildExportCsv(jsonStore, "orders", { id: "u-01" });
  const lines = csvLines(csvContent);

  assert.equal(
    lines[0],
    "orderId,placedAt,productId,productName,quantity,unitPrice,subtotal,discountAmount,totalAmount,couponCode,shippingStreet,shippingCity,shippingState,shippingPostalCode,shippingCountry",
  );
  assert.equal(lines.length, 2);
  assert.equal(
    lines[1],
    "order-01,2026-05-01T12:00:00.000Z,p-01,Desk Lamp,2,45,90,10,80,SAVE10,Av. Paulista 1000,São Paulo,SP,01310-100,Brazil",
  );
});

test("buildExportCsv emits an empty item row when an order has no lines", async () => {
  const jsonStore = createMemoryJsonStore({
    "orders.json": [
      {
        id: "order-03",
        userId: "u-01",
        placedAt: "2026-05-03T12:00:00.000Z",
        items: [],
        subtotal: 0,
        discountAmount: 0,
        totalAmount: 0,
        appliedCoupon: null,
        shippingAddress: null,
      },
    ],
  });

  const lines = csvLines(await buildExportCsv(jsonStore, "orders", { id: "u-01" }));
  assert.equal(lines.length, 2);
  assert.equal(lines[1], "order-03,2026-05-03T12:00:00.000Z,,,,,0,0,0,,,,,,");
});

test("buildExportCsv counts likes from postLikes.json and keeps the comments count", async () => {
  const jsonStore = createMemoryJsonStore({
    "posts.json": [
      {
        id: "post-01",
        authorId: "u-01",
        createdAt: "2026-05-01T18:42:00Z",
        content: "Studio notes",
        imageUrl: "https://images.example/mic.jpg",
        likes: 99,
        comments: 7,
      },
      {
        id: "post-02",
        authorId: "u-02",
        createdAt: "2026-05-02T18:42:00Z",
        content: "Someone else",
        imageUrl: "",
        likes: 1,
        comments: 0,
      },
    ],
    "postLikes.json": [
      { postId: "post-01", userId: "u-02" },
      { postId: "post-01", userId: "u-03" },
    ],
  });

  const lines = csvLines(await buildExportCsv(jsonStore, "posts", { id: "u-01" }));
  assert.equal(lines[0], "postId,createdAt,content,imageUrl,likes,comments");
  assert.equal(lines.length, 2);
  assert.equal(
    lines[1],
    "post-01,2026-05-01T18:42:00Z,Studio notes,https://images.example/mic.jpg,2,7",
  );
});
