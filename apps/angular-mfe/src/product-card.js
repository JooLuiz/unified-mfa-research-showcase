import "./styles.css";

export function mountProductCard(containerElement, props) {
  const quantityDefault = props.defaultQuantity || 1;
  let quantityValue = quantityDefault;

  const renderCard = () => {
    containerElement.innerHTML = `
      <article class="card-shell">
        <img src="${props.product.image}" alt="${props.product.name}" />
        <strong>${props.product.name}</strong>
        <span>$${props.product.price.toFixed(2)}</span>
        <label>
          Quantity Selector
          <input id="quantityInput" type="number" min="1" value="${quantityValue}" />
        </label>
        <button id="productDetailsButton" class="button-like">View Product</button>
        <button id="addToCartButton" class="button-like">Add to Cart Button</button>
      </article>
    `;

    const quantityInput = containerElement.querySelector("#quantityInput");
    const productDetailsButton = containerElement.querySelector("#productDetailsButton");
    const addToCartButton = containerElement.querySelector("#addToCartButton");

    quantityInput.addEventListener("change", (event) => {
      const parsedQuantity = Number(event.target.value);
      quantityValue = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
      event.target.value = quantityValue;
    });

    productDetailsButton.addEventListener("click", () => {
      props.onProductClick(props.product.id);
    });

    addToCartButton.addEventListener("click", () => {
      props.onAddToCart({
        productId: props.product.id,
        quantity: quantityValue,
      });
    });
  };

  renderCard();

  return () => {
    containerElement.innerHTML = "";
  };
}
