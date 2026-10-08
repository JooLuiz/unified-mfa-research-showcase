/**
 * Persists one active cart per user for the mock data service.
 * Role: Reads, replaces, and removes cart rows in carts.json.
 * Not in this file: HTTP routing (src/routes/cartRoutes.js) or order placement (src/domain/orderProcessing.js).
 * Key dependencies: JSON store.
 * See also: src/routes/cartRoutes.js; src/domain/orderProcessing.js.
 */

const CARTS_FILE_NAME = "carts.json";
const CART_REQUEST_INVALID_CODE = "invalid-cart-request";
const CART_PERSISTENCE_FAILED_CODE = "cart-persistence-failed";

/**
 * Returns an empty cart payload.
 *
 * @returns {{ items: Array<{ productId: string, quantity: number }>, appliedCoupon: null, updatedAt: null }} Empty cart.
 */
function createEmptyCart() {
  return {
    items: [],
    appliedCoupon: null,
    updatedAt: null,
  };
}

/**
 * Checks that a cart item has a product id and a whole quantity of at least 1.
 *
 * @param {unknown} cartItem - Candidate item from the request body.
 * @returns {cartItem is { productId: string, quantity: number }} Whether the item can be stored.
 */
function isValidCartItem(cartItem) {
  if (!cartItem || typeof cartItem !== "object") {
    return false;
  }
  const candidate = /** @type {{ productId?: unknown, quantity?: unknown }} */ (cartItem);
  if (typeof candidate.productId !== "string" || candidate.productId.trim() === "") {
    return false;
  }
  return Number.isInteger(candidate.quantity) && candidate.quantity >= 1;
}

/**
 * Checks that a coupon is absent or has a code and a finite non-negative discount.
 *
 * @param {unknown} appliedCoupon - Candidate coupon from the request body.
 * @returns {boolean} Whether the coupon can be stored.
 */
function isValidAppliedCoupon(appliedCoupon) {
  if (appliedCoupon === null || appliedCoupon === undefined) {
    return true;
  }
  if (typeof appliedCoupon !== "object") {
    return false;
  }
  const candidate = /** @type {{ code?: unknown, discountPercentage?: unknown }} */ (appliedCoupon);
  if (typeof candidate.code !== "string" || candidate.code.trim() === "") {
    return false;
  }
  return (
    typeof candidate.discountPercentage === "number" &&
    Number.isFinite(candidate.discountPercentage) &&
    candidate.discountPercentage >= 0
  );
}

/**
 * Copies valid items, combining quantities when the same product appears twice.
 *
 * @param {Array<{ productId: string, quantity: number }>} cartItems - Validated cart items.
 * @returns {Array<{ productId: string, quantity: number }>} One row per product id.
 */
function combineCartItems(cartItems) {
  const quantityByProductId = new Map();
  cartItems.forEach((cartItem) => {
    const currentQuantity = quantityByProductId.get(cartItem.productId) || 0;
    quantityByProductId.set(cartItem.productId, currentQuantity + cartItem.quantity);
  });
  return Array.from(quantityByProductId, ([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

/**
 * Reads the stored cart list, rejecting a file that is not an array.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }} jsonStore - JSON store bound to service data files.
 * @returns {Promise<{ ok: true, carts: object[] } | { ok: false, code: string }>} Cart rows or a persistence failure.
 */
async function readCartRows(jsonStore) {
  try {
    const cartsData = await jsonStore.readJsonFileWithDefault(CARTS_FILE_NAME, []);
    if (!Array.isArray(cartsData)) {
      return { ok: false, code: CART_PERSISTENCE_FAILED_CODE };
    }
    return { ok: true, carts: cartsData };
  } catch (error) {
    console.error("readCartRows - error");
    console.error(error);
    return { ok: false, code: CART_PERSISTENCE_FAILED_CODE };
  }
}

/**
 * Returns the user's saved cart, or an empty cart when no row exists.
 *
 * @param {{ jsonStore: { readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }, userId: string }} cartInput - Store and authenticated user id.
 * @returns {Promise<{ ok: true, cart: { items: object[], appliedCoupon: object | null, updatedAt: string | null } } | { ok: false, code: string }>} Stored cart.
 */
async function getCartForUser({ jsonStore, userId }) {
  const cartRows = await readCartRows(jsonStore);
  if (!cartRows.ok) {
    return cartRows;
  }
  const matchingCart = cartRows.carts.find((cartRecord) => cartRecord.userId === userId);
  if (!matchingCart) {
    return { ok: true, cart: createEmptyCart() };
  }
  return {
    ok: true,
    cart: {
      items: Array.isArray(matchingCart.items) ? matchingCart.items : [],
      appliedCoupon: matchingCart.appliedCoupon || null,
      updatedAt: matchingCart.updatedAt || null,
    },
  };
}

/**
 * Replaces the user's cart row with the submitted items and coupon.
 *
 * @param {{ jsonStore: { readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }, userId: string, cartPayload: { items?: unknown, appliedCoupon?: unknown } }} cartInput - Store, user, and replacement cart.
 * @returns {Promise<{ ok: true, cart: object } | { ok: false, code: string }>} Saved cart or a validation/persistence failure.
 * @sideEffects Writes carts.json when the payload is valid.
 */
async function saveCartForUser({ jsonStore, userId, cartPayload }) {
  const rawItems = Array.isArray(cartPayload.items) ? cartPayload.items : null;
  if (!rawItems || rawItems.some((cartItem) => !isValidCartItem(cartItem))) {
    return { ok: false, code: CART_REQUEST_INVALID_CODE };
  }
  if (!isValidAppliedCoupon(cartPayload.appliedCoupon)) {
    return { ok: false, code: CART_REQUEST_INVALID_CODE };
  }

  const cartRows = await readCartRows(jsonStore);
  if (!cartRows.ok) {
    return cartRows;
  }

  const savedCart = {
    userId,
    items: combineCartItems(rawItems),
    appliedCoupon: cartPayload.appliedCoupon || null,
    updatedAt: new Date().toISOString(),
  };
  const matchingIndex = cartRows.carts.findIndex((cartRecord) => cartRecord.userId === userId);
  if (matchingIndex === -1) {
    cartRows.carts.push(savedCart);
  } else {
    cartRows.carts[matchingIndex] = savedCart;
  }

  try {
    await jsonStore.writeJsonFile(CARTS_FILE_NAME, cartRows.carts);
    return { ok: true, cart: savedCart };
  } catch (error) {
    console.error("saveCartForUser - error");
    console.error(error);
    return { ok: false, code: CART_PERSISTENCE_FAILED_CODE };
  }
}

/**
 * Removes the user's cart row after an order is placed.
 *
 * @param {{ jsonStore: { readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }, userId: string }} cartInput - Store and authenticated user id.
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>} Whether the row was removed.
 * @sideEffects Writes carts.json without that user's row.
 */
async function clearCartForUser({ jsonStore, userId }) {
  const cartRows = await readCartRows(jsonStore);
  if (!cartRows.ok) {
    return cartRows;
  }
  const remainingCarts = cartRows.carts.filter((cartRecord) => cartRecord.userId !== userId);
  try {
    await jsonStore.writeJsonFile(CARTS_FILE_NAME, remainingCarts);
    return { ok: true };
  } catch (error) {
    console.error("clearCartForUser - error");
    console.error(error);
    return { ok: false, code: CART_PERSISTENCE_FAILED_CODE };
  }
}

module.exports = {
  CART_PERSISTENCE_FAILED_CODE,
  CART_REQUEST_INVALID_CODE,
  clearCartForUser,
  getCartForUser,
  saveCartForUser,
};
