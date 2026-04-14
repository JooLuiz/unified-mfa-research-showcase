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
  containerElement.innerHTML = `
    <section class="pdp-shell">
      <div>
        <img src="${selectedProduct.image}" alt="${selectedProduct.name}" />
      </div>
      <div>
        <h2>Product Name</h2>
        <p>${selectedProduct.name}</p>
        <h3>Product Price</h3>
        <p>$${selectedProduct.price.toFixed(2)}</p>
        <label>
          Product Quantity Selector
          <input id="productQuantity" type="number" min="1" value="${quantityValue}" />
        </label>
        <button id="addToCartButton" class="button-like">Add to Cart Button</button>
      </div>
    </section>
    <section id="similarProductsMount"></section>
  `;

  const quantityInput = containerElement.querySelector("#productQuantity");
  const addToCartButton = containerElement.querySelector("#addToCartButton");
  const similarProductsMount = containerElement.querySelector("#similarProductsMount");

  quantityInput.addEventListener("change", (event) => {
    const parsedQuantity = Number(event.target.value);
    quantityValue = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
    event.target.value = quantityValue;
  });

  addToCartButton.addEventListener("click", () => {
    props.onAddToCart({
      productId: selectedProduct.id,
      quantity: quantityValue,
    });
  });

  const cleanupSimilarProducts = props.mountSimilarProducts(similarProductsMount, {
    title: "Similar Products Showcase",
    products: props.similarProducts,
  });

  return () => {
    if (typeof cleanupSimilarProducts === "function") {
      cleanupSimilarProducts();
    }
    containerElement.innerHTML = "";
  };
}
