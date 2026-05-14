import { createApp, h, onMounted, onUnmounted, ref, watch } from "vue";
import "./styles.css";

const normalizeQuantity = (nextQuantity) => {
  const parsedQuantity = Number(nextQuantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    return 1;
  }
  return Math.floor(parsedQuantity);
};

async function fetchProductById(apiBaseUrl, productId, signal) {
  const response = await fetch(`${apiBaseUrl}/products/${productId}`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchProductById - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

const ProductCardComponent = {
  props: {
    product: {
      type: Object,
      default: null,
    },
    productId: {
      type: String,
      default: "",
    },
    apiBaseUrl: {
      type: String,
      default: "",
    },
    defaultQuantity: {
      type: Number,
      default: 1,
    },
    actionLabel: {
      type: String,
      default: "Add to Cart",
    },
    hideQuantity: {
      type: Boolean,
      default: false,
    },
    onProductClick: Function,
    onAddToCart: Function,
  },
  setup(props) {
    const quantityValue = ref(normalizeQuantity(props.defaultQuantity));
    const productData = ref(props.product || null);
    const isLoading = ref(false);
    const loadError = ref(null);
    let activeAbortController = null;

    const loadProduct = async () => {
      if (props.product) {
        productData.value = props.product;
        isLoading.value = false;
        loadError.value = null;
        return;
      }

      if (!props.productId || !props.apiBaseUrl) {
        productData.value = null;
        return;
      }

      if (activeAbortController) {
        activeAbortController.abort();
      }

      const abortController = new AbortController();
      activeAbortController = abortController;
      isLoading.value = true;
      loadError.value = null;

      try {
        const fetchedProduct = await fetchProductById(
          props.apiBaseUrl,
          props.productId,
          abortController.signal,
        );
        if (!abortController.signal.aborted) {
          productData.value = fetchedProduct;
        }
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        console.warn("loadProduct - error");
        console.warn(error);
        loadError.value = error;
        productData.value = null;
      } finally {
        if (activeAbortController === abortController) {
          activeAbortController = null;
        }
        if (!abortController.signal.aborted) {
          isLoading.value = false;
        }
      }
    };

    onMounted(loadProduct);
    onUnmounted(() => {
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
    });

    watch(
      () => [props.product, props.productId, props.apiBaseUrl],
      () => {
        quantityValue.value = normalizeQuantity(props.defaultQuantity);
        loadProduct();
      },
    );

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
      const currentProduct = productData.value;
      if (!currentProduct || typeof props.onProductClick !== "function") {
        return;
      }
      props.onProductClick(currentProduct.id);
    };

    const handleActionClick = () => {
      const currentProduct = productData.value;
      if (!currentProduct || typeof props.onAddToCart !== "function") {
        return;
      }
      props.onAddToCart({
        productId: currentProduct.id,
        quantity: props.hideQuantity ? 1 : quantityValue.value,
      });
    };

    const renderQuantityControls = () =>
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
      ]);

    return () => {
      if (isLoading.value && !productData.value) {
        return h(
          "article",
          { class: "card-shell card-shell-loading" },
          "Loading product...",
        );
      }

      if (loadError.value || !productData.value) {
        return h(
          "article",
          { class: "card-shell card-shell-error" },
          "Product unavailable.",
        );
      }

      const currentProduct = productData.value;

      return h("article", { class: "card-shell" }, [
        h("img", {
          class: "product-image-clickable",
          src: currentProduct.image,
          alt: currentProduct.name,
          onClick: handleProductClick,
        }),
        h("strong", { class: "product-name" }, currentProduct.name),
        h("span", `$${Number(currentProduct.price).toFixed(2)}`),
        props.hideQuantity ? null : renderQuantityControls(),
        h(
          "button",
          {
            class: "button-like add-cart-button",
            type: "button",
            onClick: handleActionClick,
          },
          props.actionLabel,
        ),
      ]);
    };
  },
};

export function mountProductCard(containerElement, props) {
  const productCardApp = createApp(ProductCardComponent, {
    product: props.product,
    productId: props.productId,
    apiBaseUrl: props.apiBaseUrl,
    defaultQuantity: props.defaultQuantity,
    actionLabel: props.actionLabel,
    hideQuantity: props.hideQuantity,
    onProductClick: props.onProductClick,
    onAddToCart: props.onAddToCart,
  });
  productCardApp.mount(containerElement);

  return () => {
    productCardApp.unmount();
    containerElement.innerHTML = "";
  };
}
