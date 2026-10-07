/**
 * Shapes cart lines and coupons for storage and login merge.
 * Role: Pure copies and the guest-plus-saved quantity merge.
 * Not in this file: HTTP saves, shell state, or cross-tab messages (src/utils/cartSync.js).
 * Key dependencies: None.
 * See also: src/utils/cartSync.js.
 */

/**
 * Copies cart lines that have a product id and a quantity of at least 1.
 *
 * @param {unknown} cartItems - Candidate cart lines.
 * @returns {Array<{ productId: string, quantity: number }>} Stored line shape.
 */
function cloneCartItems(cartItems) {
  if (!Array.isArray(cartItems)) {
    return [];
  }
  return cartItems
    .filter((cartItem) => {
      const quantity = Number(cartItem?.quantity);
      return (
        typeof cartItem?.productId === "string" &&
        cartItem.productId.trim() !== "" &&
        Number.isFinite(quantity) &&
        quantity >= 1
      );
    })
    .map((cartItem) => ({
      productId: cartItem.productId,
      quantity: Math.floor(Number(cartItem.quantity)),
    }));
}

/**
 * Copies a coupon the cart API can store.
 *
 * @param {unknown} appliedCoupon - Candidate coupon.
 * @returns {{ code: string, discountPercentage: number } | null} Stored coupon, or null.
 */
function cloneAppliedCoupon(appliedCoupon) {
  if (!appliedCoupon || typeof appliedCoupon !== "object") {
    return null;
  }
  const candidate = /** @type {{ code?: unknown, discountPercentage?: unknown }} */ (appliedCoupon);
  const discountPercentage = Number(candidate.discountPercentage);
  if (typeof candidate.code !== "string" || candidate.code.trim() === "") {
    return null;
  }
  if (!Number.isFinite(discountPercentage) || discountPercentage < 0) {
    return null;
  }
  return {
    code: candidate.code,
    discountPercentage,
  };
}

/**
 * Adds guest quantities onto the saved cart, one row per product.
 *
 * @param {unknown} savedItems - Items already stored for the user.
 * @param {unknown} guestItems - Items added in this tab before sign-in.
 * @returns {Array<{ productId: string, quantity: number }>} Merged lines.
 */
function mergeCartItems(savedItems, guestItems) {
  const quantityByProductId = new Map();
  [...cloneCartItems(savedItems), ...cloneCartItems(guestItems)].forEach((cartItem) => {
    const currentQuantity = quantityByProductId.get(cartItem.productId) || 0;
    quantityByProductId.set(cartItem.productId, currentQuantity + cartItem.quantity);
  });
  return Array.from(quantityByProductId, ([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export { cloneAppliedCoupon, cloneCartItems, mergeCartItems };
