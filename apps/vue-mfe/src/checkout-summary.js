import { createApp, h } from "vue";
import "./styles.css";

const CheckoutSummaryComponent = {
  props: {
    subtotal: Number,
    discountAmount: Number,
  },
  setup(props) {
    const totalValue = Math.max(props.subtotal - props.discountAmount, 0);
    return () =>
      h("section", { class: "checkout-summary-shell" }, [
        h("h3", "Checkout Order Summary Component"),
        h("div", { class: "summary-row" }, [h("span", "Subtotal"), h("span", `$${props.subtotal.toFixed(2)}`)]),
        h("div", { class: "summary-row" }, [h("span", "Discount"), h("span", `-$${props.discountAmount.toFixed(2)}`)]),
        h("div", { class: "summary-row" }, [h("strong", "Total"), h("strong", `$${totalValue.toFixed(2)}`)]),
      ]);
  },
};

export function mountCheckoutSummary(containerElement, props) {
  const app = createApp(CheckoutSummaryComponent, {
    subtotal: props.subtotal,
    discountAmount: props.discountAmount,
  });
  app.mount(containerElement);

  return () => {
    app.unmount();
    containerElement.innerHTML = "";
  };
}
