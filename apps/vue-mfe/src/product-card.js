import { createApp, h, ref } from "vue";
import "./styles.css";

const normalizeQuantity = (nextQuantity) => {
  const parsedQuantity = Number(nextQuantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    return 1;
  }
  return Math.floor(parsedQuantity);
};

const ProductCardComponent = {
  props: {
    product: {
      type: Object,
      default: () => ({ id: "", name: "", price: 0, image: "" }),
    },
    defaultQuantity: {
      type: Number,
      default: 1,
    },
    onProductClick: Function,
    onAddToCart: Function,
  },
  setup(props) {
    const quantityValue = ref(normalizeQuantity(props.defaultQuantity));

    const decreaseQuantity = () => {
      quantityValue.value = Math.max(quantityValue.value - 1, 1);
    };

    const increaseQuantity = () => {
      quantityValue.value += 1;
    };

    const handleQuantityChange = (changeEvent) => {
      const targetInput = changeEvent.target;
      const nextQuantity = normalizeQuantity(Number(targetInput?.value));
      quantityValue.value = nextQuantity;
      if (targetInput) {
        targetInput.value = String(nextQuantity);
      }
    };

    const handleProductClick = () => {
      if (typeof props.onProductClick === "function") {
        props.onProductClick(props.product.id);
      }
    };

    const handleAddToCart = () => {
      if (typeof props.onAddToCart === "function") {
        props.onAddToCart({
          productId: props.product.id,
          quantity: quantityValue.value,
        });
      }
    };

    return () =>
      h("article", { class: "card-shell" }, [
        h("img", {
          class: "product-image-clickable",
          src: props.product.image,
          alt: props.product.name,
          onClick: handleProductClick,
        }),
        h("strong", { class: "product-name" }, props.product.name),
        h("span", `$${Number(props.product.price).toFixed(2)}`),
        h("div", { class: "quantity-shell" }, [
          h(
            "button",
            {
              class: "quantity-control-button",
              type: "button",
              onClick: decreaseQuantity,
            },
            "-",
          ),
          h("input", {
            class: "quantity-value-input",
            type: "number",
            min: "1",
            value: quantityValue.value,
            onChange: handleQuantityChange,
          }),
          h(
            "button",
            {
              class: "quantity-control-button",
              type: "button",
              onClick: increaseQuantity,
            },
            "+",
          ),
        ]),
        h(
          "button",
          {
            class: "button-like add-cart-button",
            type: "button",
            onClick: handleAddToCart,
          },
          "Add to Cart",
        ),
      ]);
  },
};

export function mountProductCard(containerElement, props) {
  const productCardApp = createApp(ProductCardComponent, {
    product: props.product,
    defaultQuantity: props.defaultQuantity,
    onProductClick: props.onProductClick,
    onAddToCart: props.onAddToCart,
  });
  productCardApp.mount(containerElement);

  return () => {
    productCardApp.unmount();
    containerElement.innerHTML = "";
  };
}
