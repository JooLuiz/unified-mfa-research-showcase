import "./styles.css";

export function mountProductDetails(containerElement, props) {
  const selectedProduct = props.product;

  if (!selectedProduct) {
    containerElement.innerHTML = `<section class="pdp-shell"><p>Product not found.</p></section>`;
    return () => {
      containerElement.innerHTML = "";
    };
  }

  let quantityValue = 1;
  const normalizeQuantity = (value) => {
    const parsedQuantity = Number(value);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      return 1;
    }
    return Math.floor(parsedQuantity);
  };

  containerElement.innerHTML = `
    <section class="pdp-shell">
      <div>
        <img src="${selectedProduct.image}" alt="${selectedProduct.name}" />
      </div>
      <div class="pdp-details-column">
        <h2>${selectedProduct.name}</h2>
        <h3>Price</h3>
        <p>$${selectedProduct.price.toFixed(2)}</p>
        <div class="quantity-shell">
          <button id="decreaseQuantityButton" class="quantity-control-button" type="button">-</button>
          <input
            id="productQuantity"
            class="quantity-value-input"
            type="number"
            min="1"
            value="${quantityValue}"
          />
          <button id="increaseQuantityButton" class="quantity-control-button" type="button">+</button>
        </div>
        <button id="addToCartButton" class="button-like pdp-add-to-cart-button">Add to Cart</button>
      </div>
    </section>
    <section id="similarProductsMount"></section>
  `;

  const decreaseQuantityButton = containerElement.querySelector(
    "#decreaseQuantityButton",
  );
  const increaseQuantityButton = containerElement.querySelector(
    "#increaseQuantityButton",
  );
  const quantityInput = containerElement.querySelector("#productQuantity");
  const addToCartButton = containerElement.querySelector("#addToCartButton");
  const similarProductsMount = containerElement.querySelector(
    "#similarProductsMount",
  );

  decreaseQuantityButton.addEventListener("click", () => {
    quantityValue = Math.max(quantityValue - 1, 1);
    quantityInput.value = quantityValue;
  });

  increaseQuantityButton.addEventListener("click", () => {
    quantityValue += 1;
    quantityInput.value = quantityValue;
  });

  quantityInput.addEventListener("change", (event) => {
    quantityValue = normalizeQuantity(event.target.value);
    event.target.value = quantityValue;
  });

  addToCartButton.addEventListener("click", () => {
    props.onAddToCart({
      productId: selectedProduct.id,
      quantity: quantityValue,
    });
  });

  const cleanupSimilarProducts = props.mountSimilarProducts(
    similarProductsMount,
    {
      title: "Similar Products Showcase",
      products: props.similarProducts,
    },
  );

  return () => {
    if (typeof cleanupSimilarProducts === "function") {
      cleanupSimilarProducts();
    }
    containerElement.innerHTML = "";
  };
}
