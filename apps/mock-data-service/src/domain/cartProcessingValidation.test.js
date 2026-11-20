/**
 * Verifies cart payloads and clears that the main cart suite does not reach.
 * Role: Locks rejected item and coupon shapes, and a clear that cannot be written.
 * Not in this file: A successful save or order placement.
 * Key dependencies: node:test; src/domain/cartProcessing.js.
 * See also: src/domain/cartProcessing.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CART_PERSISTENCE_FAILED_CODE,
  CART_REQUEST_INVALID_CODE,
  clearCartForUser,
  saveCartForUser,
} = require("./cartProcessing");

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

test("saveCartForUser rejects a non-object item and a non-object coupon", async () => {
  const jsonStore = createMemoryJsonStore({ "carts.json": [] });

  const itemResult = await saveCartForUser({
    jsonStore,
    userId: "u-01",
    cartPayload: { items: ["p-01"], appliedCoupon: null },
  });
  assert.deepEqual(itemResult, { ok: false, code: CART_REQUEST_INVALID_CODE });

  const couponResult = await saveCartForUser({
    jsonStore,
    userId: "u-01",
    cartPayload: {
      items: [{ productId: "p-01", quantity: 1 }],
      appliedCoupon: "ten",
    },
  });
  assert.deepEqual(couponResult, { ok: false, code: CART_REQUEST_INVALID_CODE });
  assert.deepEqual(jsonStore.files["carts.json"], []);
});

test("clearCartForUser reports a failed write and leaves the user row in place", async () => {
  const savedRow = {
    userId: "u-01",
    items: [{ productId: "p-01", quantity: 1 }],
    appliedCoupon: null,
  };
  const jsonStore = createMemoryJsonStore({ "carts.json": [savedRow] });
  jsonStore.writeJsonFile = async function failWrite() {
    throw new Error("disk full");
  };

  const clearResult = await clearCartForUser({ jsonStore, userId: "u-01" });

  assert.deepEqual(clearResult, { ok: false, code: CART_PERSISTENCE_FAILED_CODE });
  assert.equal(jsonStore.files["carts.json"][0].userId, "u-01");
  assert.equal(jsonStore.files["carts.json"][0].items[0].quantity, 1);
});
