import { computed, h, onMounted, onUnmounted, ref, watch } from "vue";
import { useProductAvailability } from "./useProductAvailability";

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

export const ProductCardComponent = {
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
    variant: {
      type: String,
      default: "default",
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

    const { availableCount } = useProductAvailability({
      productRef: productData,
      getApiBaseUrl: () => props.apiBaseUrl,
      quantityRef: quantityValue,
    });
    const isOutOfStock = computed(() => availableCount.value === 0);
    const isAtMaxQuantity = computed(
      () => typeof availableCount.value === "number" && quantityValue.value >= availableCount.value,
    );
    const availableLabel = computed(() =>
      availableCount.value === null ? "" : `${availableCount.value} available`,
    );

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
      const maxAllowed = availableCount.value;
      quantityValue.value =
        typeof maxAllowed === "number"
          ? Math.min(quantityValue.value + 1, maxAllowed)
          : quantityValue.value + 1;
    };

    const handleQuantityChange = (changeEvent) => {
      const targetInput = changeEvent.target;
      const maxAllowed = availableCount.value;
      let nextQuantity = normalizeQuantity(Number(targetInput?.value));
      if (typeof maxAllowed === "number") {
        nextQuantity = Math.min(nextQuantity, maxAllowed);
      }
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
      if (!currentProduct || isOutOfStock.value || typeof props.onAddToCart !== "function") {
        return;
      }
      props.onAddToCart({
        productId: currentProduct.id,
        quantity: props.hideQuantity ? 1 : quantityValue.value,
      });
    };

    const renderAvailability = () => {
      if (availableCount.value === null) {
        return null;
      }
      return h(
        "span",
        { class: isOutOfStock.value ? "product-availability out-of-stock" : "product-availability" },
        isOutOfStock.value ? "Out of stock" : availableLabel.value,
      );
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
          max: availableCount.value ?? undefined,
          value: quantityValue.value,
          onChange: handleQuantityChange,
        }),
        h(
          "button",
          {
            class: "quantity-control-button",
            type: "button",
            disabled: isAtMaxQuantity.value,
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

      if (props.variant === "compact") {
        return h("article", { class: "card-shell card-shell-compact" }, [
          h("img", {
            class: "product-image-clickable card-compact-image",
            src: currentProduct.image,
            alt: currentProduct.name,
            onClick: handleProductClick,
          }),
          h("div", { class: "card-compact-info" }, [
            h(
              "strong",
              { class: "product-name card-compact-name" },
              currentProduct.name,
            ),
            renderAvailability(),
            isOutOfStock.value
              ? null
              : h(
                  "button",
                  {
                    class: "button-like add-cart-button",
                    type: "button",
                    onClick: handleActionClick,
                  },
                  props.actionLabel,
                ),
          ]),
        ]);
      }

      return h("article", { class: "card-shell" }, [
        h("img", {
          class: "product-image-clickable",
          src: currentProduct.image,
          alt: currentProduct.name,
          onClick: handleProductClick,
        }),
        h("strong", { class: "product-name" }, currentProduct.name),
        h("span", `$${Number(currentProduct.price).toFixed(2)}`),
        renderAvailability(),
        props.hideQuantity || isOutOfStock.value ? null : renderQuantityControls(),
        isOutOfStock.value
          ? null
          : h(
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
