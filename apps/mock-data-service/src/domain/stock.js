/**
 * Owns the live-stock rule shared by every product read and cart edit.
 * Role: Computes "available" (stock minus every active hold), and reserves, releases, and
 *   consumes holds. A hold is a saved-cart line (signed-in) or a guestHolds.json line (guest).
 * Not in this file: HTTP routing (src/routes/stockRoutes.js, src/routes/catalogRoutes.js) or the
 *   SSE watcher registry (src/infrastructure/stockEventStream.js).
 * Key dependencies: products.json; src/domain/cartProcessing.js; src/domain/guestHolds.js.
 * See also: src/domain/orderProcessing.js (consumes stock on sale).
 */

const { getCartForUser, saveCartForUser } = require("./cartProcessing");
const {
  readGuestHoldsData,
  getGuestHoldQuantity,
  getTotalGuestHoldQuantity,
  writeGuestHoldLine,
  deleteGuestHoldSession,
} = require("./guestHolds");

const PRODUCTS_FILE_NAME = "products.json";
const CARTS_FILE_NAME = "carts.json";
const STOCK_INSUFFICIENT_CODE = "insufficient-stock";
const STOCK_REQUEST_INVALID_CODE = "invalid-stock-request";
const STOCK_PERSISTENCE_FAILED_CODE = "stock-persistence-failed";

async function readProductsData(jsonStore) {
  try {
    const productsData = await jsonStore.readJsonFile(PRODUCTS_FILE_NAME);
    return { ok: true, products: productsData };
  } catch (error) {
    console.error("readProductsData - error");
    console.error(error);
    return { ok: false, code: STOCK_PERSISTENCE_FAILED_CODE };
  }
}

async function readCartsData(jsonStore) {
  try {
    const cartsData = await jsonStore.readJsonFileWithDefault(CARTS_FILE_NAME, []);
    return { ok: true, carts: Array.isArray(cartsData) ? cartsData : [] };
  } catch (error) {
    console.error("readCartsData - error");
    console.error(error);
    return { ok: false, code: STOCK_PERSISTENCE_FAILED_CODE };
  }
}

function getCartHoldQuantity(cartsData, productId) {
  return cartsData.reduce((total, cartRecord) => {
    const items = Array.isArray(cartRecord.items) ? cartRecord.items : [];
    const matchingLine = items.find((item) => item.productId === productId);
    return total + (matchingLine ? matchingLine.quantity : 0);
  }, 0);
}

/**
 * Computes the unreserved count for one product. Includes every hold, including the caller's own.
 *
 * @param {{ productStock: number, cartsData: object[], guestHoldsData: Record<string, object[]>, productId: string }} availabilityInput - Stock and every current hold source.
 * @returns {number} Units still free to reserve.
 */
function computeAvailableForProduct({ productStock, cartsData, guestHoldsData, productId }) {
  const cartHeld = getCartHoldQuantity(cartsData, productId);
  const guestHeld = getTotalGuestHoldQuantity(guestHoldsData, productId);
  return Math.max(productStock - cartHeld - guestHeld, 0);
}

/**
 * Loads products, carts, and guest holds together so availability math reads one consistent snapshot.
 *
 * @param {object} jsonStore - JSON file store bound to the data directory.
 * @returns {Promise<{ ok: true, products: object[], cartsData: object[], guestHoldsData: Record<string, object[]> } | { ok: false, code: string }>} Availability context, or the first read failure.
 */
async function getAvailabilityContext(jsonStore) {
  const productsResult = await readProductsData(jsonStore);
  if (!productsResult.ok) {
    return productsResult;
  }
  const cartsResult = await readCartsData(jsonStore);
  if (!cartsResult.ok) {
    return cartsResult;
  }
  const guestHoldsResult = await readGuestHoldsData(jsonStore);
  if (!guestHoldsResult.ok) {
    return guestHoldsResult;
  }
  return {
    ok: true,
    products: productsResult.products,
    cartsData: cartsResult.carts,
    guestHoldsData: guestHoldsResult.guestHolds,
  };
}

function computeAvailableForContext(context, productId, matchingProduct) {
  return computeAvailableForProduct({
    productStock: Number(matchingProduct.stock) || 0,
    cartsData: context.cartsData,
    guestHoldsData: context.guestHoldsData,
    productId,
  });
}

/**
 * Returns every product annotated with its live `available` count.
 *
 * @param {object} jsonStore - JSON file store bound to the data directory.
 * @returns {Promise<{ ok: true, products: object[] } | { ok: false, code: string }>} Products including `available`.
 */
async function getProductsWithAvailability(jsonStore) {
  const context = await getAvailabilityContext(jsonStore);
  if (!context.ok) {
    return context;
  }
  const productsWithAvailability = context.products.map((product) => ({
    ...product,
    available: computeAvailableForContext(context, product.id, product),
  }));
  return { ok: true, products: productsWithAvailability };
}

/**
 * Returns the live `available` count for one product.
 *
 * @param {{ jsonStore: object, productId: string }} availabilityInput - Store and the product to look up.
 * @returns {Promise<{ ok: true, available: number } | { ok: false, code: string }>} Available units, or a failure.
 */
async function getAvailableStockForProduct({ jsonStore, productId }) {
  const context = await getAvailabilityContext(jsonStore);
  if (!context.ok) {
    return context;
  }
  const matchingProduct = context.products.find((product) => product.id === productId);
  if (!matchingProduct) {
    return { ok: false, code: STOCK_REQUEST_INVALID_CODE };
  }
  return { ok: true, available: computeAvailableForContext(context, productId, matchingProduct) };
}

function getHolderCurrentQuantity({ cartsData, guestHoldsData, holder, productId }) {
  if (holder.type === "user") {
    const matchingCart = cartsData.find((cartRecord) => cartRecord.userId === holder.userId);
    const items = matchingCart && Array.isArray(matchingCart.items) ? matchingCart.items : [];
    const matchingLine = items.find((item) => item.productId === productId);
    return matchingLine ? matchingLine.quantity : 0;
  }
  return getGuestHoldQuantity(guestHoldsData, holder.sessionId, productId);
}

/**
 * Writes one holder's absolute line for one product, removing the line at quantity 0.
 *
 * @param {{ jsonStore: object, holder: { type: "user", userId: string } | { type: "guest", sessionId: string }, productId: string, quantity: number }} writeInput - Store, holder identity, product, and next absolute quantity.
 * @returns {Promise<{ ok: true, cart?: object } | { ok: false, code: string }>} The saved cart for a signed-in holder, or a failure.
 * @sideEffects Writes carts.json for a signed-in holder, or guestHolds.json for a guest.
 */
async function writeHolderQuantity({ jsonStore, holder, productId, quantity }) {
  if (holder.type === "user") {
    const cartResult = await getCartForUser({ jsonStore, userId: holder.userId });
    if (!cartResult.ok) {
      return cartResult;
    }
    const remainingItems = cartResult.cart.items.filter((item) => item.productId !== productId);
    const nextItems = quantity > 0 ? [...remainingItems, { productId, quantity }] : remainingItems;
    return saveCartForUser({
      jsonStore,
      userId: holder.userId,
      cartPayload: { items: nextItems, appliedCoupon: cartResult.cart.appliedCoupon },
    });
  }
  return writeGuestHoldLine({ jsonStore, sessionId: holder.sessionId, productId, quantity });
}

function isValidProductId(productId) {
  return typeof productId === "string" && productId.trim() !== "";
}

function isValidQuantity(quantity, minimumQuantity) {
  return Number.isInteger(quantity) && quantity >= minimumQuantity;
}

/**
 * Adds a quantity to the caller's hold for one product. Rejects the whole request when the
 * added quantity is greater than what's available.
 *
 * @param {{ jsonStore: object, holder: { type: "user", userId: string } | { type: "guest", sessionId: string }, productId: string, quantity: number }} reserveInput - Store, caller identity, product, and quantity to add.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} The holder's new line quantity and the resulting available count, or a rejection.
 * @sideEffects On success, writes the holder's cart or guest-hold line.
 */
async function reserveAdditiveStock({ jsonStore, holder, productId, quantity }) {
  if (!isValidProductId(productId) || !isValidQuantity(quantity, 1)) {
    return { ok: false, code: STOCK_REQUEST_INVALID_CODE };
  }

  const context = await getAvailabilityContext(jsonStore);
  if (!context.ok) {
    return context;
  }
  const matchingProduct = context.products.find((product) => product.id === productId);
  if (!matchingProduct) {
    return { ok: false, code: STOCK_REQUEST_INVALID_CODE };
  }

  const available = computeAvailableForContext(context, productId, matchingProduct);
  if (quantity > available) {
    return { ok: false, code: STOCK_INSUFFICIENT_CODE };
  }

  const currentQuantity = getHolderCurrentQuantity({
    cartsData: context.cartsData,
    guestHoldsData: context.guestHoldsData,
    holder,
    productId,
  });
  const nextQuantity = currentQuantity + quantity;
  const writeResult = await writeHolderQuantity({ jsonStore, holder, productId, quantity: nextQuantity });
  if (!writeResult.ok) {
    return writeResult;
  }

  return {
    ok: true,
    quantity: nextQuantity,
    available: Math.max(available - quantity, 0),
    cart: writeResult.cart,
  };
}

/**
 * Sets the caller's hold for one product to an absolute quantity. 0 removes the line. The
 * maximum accepted quantity is the caller's current line plus what's available.
 *
 * @param {{ jsonStore: object, holder: { type: "user", userId: string } | { type: "guest", sessionId: string }, productId: string, quantity: number }} setInput - Store, caller identity, product, and the next absolute quantity.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} The holder's new line quantity and the resulting available count, or a rejection.
 * @sideEffects On success, writes the holder's cart or guest-hold line.
 */
async function setAbsoluteStock({ jsonStore, holder, productId, quantity }) {
  if (!isValidProductId(productId) || !isValidQuantity(quantity, 0)) {
    return { ok: false, code: STOCK_REQUEST_INVALID_CODE };
  }

  const context = await getAvailabilityContext(jsonStore);
  if (!context.ok) {
    return context;
  }
  const matchingProduct = context.products.find((product) => product.id === productId);
  if (!matchingProduct) {
    return { ok: false, code: STOCK_REQUEST_INVALID_CODE };
  }

  const available = computeAvailableForContext(context, productId, matchingProduct);
  const currentQuantity = getHolderCurrentQuantity({
    cartsData: context.cartsData,
    guestHoldsData: context.guestHoldsData,
    holder,
    productId,
  });
  const maximumQuantity = available + currentQuantity;
  if (quantity > maximumQuantity) {
    return { ok: false, code: STOCK_INSUFFICIENT_CODE };
  }

  const writeResult = await writeHolderQuantity({ jsonStore, holder, productId, quantity });
  if (!writeResult.ok) {
    return writeResult;
  }

  return {
    ok: true,
    quantity,
    available: Math.max(maximumQuantity - quantity, 0),
    cart: writeResult.cart,
  };
}

/**
 * Releases every hold a guest session has, for the stock SSE stream's `close` handler.
 *
 * @param {{ jsonStore: object, sessionId: string }} releaseInput - Store and the guest session that disconnected.
 * @returns {Promise<{ ok: true, affectedProducts: Array<{ productId: string, available: number }> } | { ok: false, code: string }>} Products whose availability changed, for the caller to broadcast.
 * @sideEffects Deletes that session's guestHolds.json row.
 */
async function releaseGuestSession({ jsonStore, sessionId }) {
  const deleteResult = await deleteGuestHoldSession({ jsonStore, sessionId });
  if (!deleteResult.ok) {
    return deleteResult;
  }
  if (deleteResult.removedLines.length === 0) {
    return { ok: true, affectedProducts: [] };
  }

  const context = await getAvailabilityContext(jsonStore);
  if (!context.ok) {
    return { ok: true, affectedProducts: [] };
  }

  const affectedProducts = deleteResult.removedLines.map((removedLine) => {
    const matchingProduct = context.products.find((product) => product.id === removedLine.productId);
    const available = matchingProduct
      ? computeAvailableForContext(context, removedLine.productId, matchingProduct)
      : 0;
    return { productId: removedLine.productId, available };
  });

  return { ok: true, affectedProducts };
}

/**
 * Decrements `stock` by each sold quantity when an order is stored.
 *
 * @param {{ jsonStore: object, items: Array<{ productId: string, quantity: number }> }} saleInput - Store and the order's line items.
 * @returns {Promise<{ ok: true, affectedProducts: Array<{ productId: string, available: number }> } | { ok: false, code: string }>} Products sold, with their resulting available count.
 * @sideEffects Writes products.json.
 */
async function consumeStockForSale({ jsonStore, items }) {
  const soldItems = Array.isArray(items) ? items : [];
  if (soldItems.length === 0) {
    return { ok: true, affectedProducts: [] };
  }

  const productsResult = await readProductsData(jsonStore);
  if (!productsResult.ok) {
    return productsResult;
  }

  const nextProducts = productsResult.products.map((product) => {
    const matchingSoldItem = soldItems.find((item) => item.productId === product.id);
    if (!matchingSoldItem) {
      return product;
    }
    const soldQuantity = Number(matchingSoldItem.quantity) || 0;
    const nextStock = Math.max((Number(product.stock) || 0) - soldQuantity, 0);
    return { ...product, stock: nextStock };
  });

  try {
    await jsonStore.writeJsonFile(PRODUCTS_FILE_NAME, nextProducts);
  } catch (error) {
    console.error("consumeStockForSale - error");
    console.error(error);
    return { ok: false, code: STOCK_PERSISTENCE_FAILED_CODE };
  }

  const context = await getAvailabilityContext(jsonStore);
  const affectedProducts = soldItems.map((soldItem) => {
    const matchingProduct = context.ok
      ? context.products.find((product) => product.id === soldItem.productId)
      : nextProducts.find((product) => product.id === soldItem.productId);
    const available =
      context.ok && matchingProduct ? computeAvailableForContext(context, soldItem.productId, matchingProduct) : 0;
    return { productId: soldItem.productId, available };
  });

  return { ok: true, affectedProducts };
}

module.exports = {
  STOCK_INSUFFICIENT_CODE,
  STOCK_REQUEST_INVALID_CODE,
  STOCK_PERSISTENCE_FAILED_CODE,
  computeAvailableForProduct,
  getProductsWithAvailability,
  getAvailableStockForProduct,
  reserveAdditiveStock,
  setAbsoluteStock,
  releaseGuestSession,
  consumeStockForSale,
};
