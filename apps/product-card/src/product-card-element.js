import { createApp } from "vue";
import { ProductCardComponent } from "./product-card-component";
import "./styles.css";

const customElementName = "vue-product-card";

class ProductCardElement extends HTMLElement {
  cardProps = {};
  productCardApp = null;

  set props(nextProps) {
    this.cardProps = nextProps || {};
    this.renderCard();
  }

  get props() {
    return this.cardProps;
  }

  connectedCallback() {
    this.renderCard();
  }

  disconnectedCallback() {
    this.unmountCard();
  }

  renderCard() {
    if (!this.isConnected) {
      return;
    }
    this.unmountCard();
    this.productCardApp = createApp(ProductCardComponent, { ...this.cardProps });
    this.productCardApp.mount(this);
  }

  unmountCard() {
    if (this.productCardApp) {
      this.productCardApp.unmount();
      this.productCardApp = null;
    }
    this.innerHTML = "";
  }
}

export function registerProductCardElement() {
  if (!customElements.get(customElementName)) {
    customElements.define(customElementName, ProductCardElement);
  }
}
