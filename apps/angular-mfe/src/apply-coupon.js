import "./styles.css";

export function mountApplyCoupon(containerElement, props) {
  const couponDiscountMap = {
    ten: 10,
    twenty: 20,
    thirty: 30,
    fourty: 40,
    fifty: 50,
  };

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
    const couponValue = couponInput.value.trim().toLowerCase();
    const discountPercentage = couponDiscountMap[couponValue];

    if (!couponValue) {
      couponMessage.textContent = "Please type a coupon code.";
      return;
    }

    if (!discountPercentage) {
      couponMessage.textContent = "Invalid coupon.";
      return;
    }

    couponMessage.textContent = `Coupon applied: ${discountPercentage}% discount.`;
    props.onCouponApplied({
      code: couponValue,
      discountPercentage,
    });
  });

  return () => {
    containerElement.innerHTML = "";
  };
}
