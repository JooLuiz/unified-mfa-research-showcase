import "./styles.css";

export function mountApplyCoupon(containerElement, props) {
  containerElement.innerHTML = `
    <section class="apply-coupon-shell">
      <h3>Apply Coupon Component</h3>
      <input id="couponInput" type="text" placeholder="Coupon code" />
      <button id="couponButton" class="button-like">Apply Coupon</button>
      <p id="couponMessage"></p>
    </section>
  `;

  const couponInput = containerElement.querySelector("#couponInput");
  const couponButton = containerElement.querySelector("#couponButton");
  const couponMessage = containerElement.querySelector("#couponMessage");

  couponButton.addEventListener("click", () => {
    const couponValue = couponInput.value.trim().toUpperCase();
    const isCouponValid = couponValue === "MFE10";

    if (!couponValue) {
      couponMessage.textContent = "Please type a coupon code.";
      return;
    }

    if (!isCouponValid) {
      couponMessage.textContent = "Invalid coupon.";
      return;
    }

    couponMessage.textContent = "Coupon applied: 10% discount.";
    props.onCouponApplied({
      code: couponValue,
      discountPercentage: 10,
    });
  });

  return () => {
    containerElement.innerHTML = "";
  };
}
