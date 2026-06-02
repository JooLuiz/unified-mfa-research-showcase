import { createApp } from "vue";
import { ProductCardComponent } from "./product-card-component";
import "./styles.css";

export function mountProductCard(containerElement, props) {
  const productCardApp = createApp(ProductCardComponent, {
    product: props.product,
    productId: props.productId,
    apiBaseUrl: props.apiBaseUrl,
    defaultQuantity: props.defaultQuantity,
    actionLabel: props.actionLabel,
    hideQuantity: props.hideQuantity,
    variant: props.variant,
    onProductClick: props.onProductClick,
    onAddToCart: props.onAddToCart,
  });
  productCardApp.mount(containerElement);

  return () => {
    productCardApp.unmount();
    containerElement.innerHTML = "";
  };
}
