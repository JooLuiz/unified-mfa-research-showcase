import "./styles.css";

class ProductShowcaseElement extends HTMLElement {
  connectedCallback() {
    this.renderElement();
  }

  disconnectedCallback() {
    this.cleanupCards();
  }

  set config(nextConfig) {
    this.internalConfig = nextConfig;
    this.renderElement();
  }

  cleanupCards() {
    if (!Array.isArray(this.cardCleanupFunctions)) {
      return;
    }

    this.cardCleanupFunctions.forEach((cleanup) => {
      if (typeof cleanup === "function") {
        cleanup();
      }
    });
    this.cardCleanupFunctions = [];
  }

  renderElement() {
    if (!this.isConnected) {
      return;
    }

    const configuration = this.internalConfig || {};
    const products = Array.isArray(configuration.products) ? configuration.products : [];
    const title = configuration.title || "Showcase Title";
    const mountProductCard = configuration.mountProductCard;
    const onProductClick = configuration.onProductClick;
    const onAddToCart = configuration.onAddToCart;

    this.cleanupCards();
    this.innerHTML = `
      <section class="showcase-shell">
        <h3>${title}</h3>
        <div id="showcaseGrid" class="showcase-grid"></div>
      </section>
    `;

    const showcaseGrid = this.querySelector("#showcaseGrid");
    if (!showcaseGrid || typeof mountProductCard !== "function") {
      return;
    }

    this.cardCleanupFunctions = products.map((product) => {
      const slotElement = document.createElement("div");
      showcaseGrid.appendChild(slotElement);
      return mountProductCard(slotElement, {
        product,
        onProductClick,
        onAddToCart,
      });
    });
  }
}

export function registerProductShowcaseElement() {
  const customElementName = "angular-product-showcase";
  if (!customElements.get(customElementName)) {
    customElements.define(customElementName, ProductShowcaseElement);
  }
}

export function mountProductShowcase(containerElement, props) {
  const showcaseElement = document.createElement("angular-product-showcase");
  containerElement.appendChild(showcaseElement);
  showcaseElement.config = props;

  return () => {
    containerElement.innerHTML = "";
  };
}
