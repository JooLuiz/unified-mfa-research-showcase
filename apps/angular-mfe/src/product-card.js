import "./styles.css";

export function mountProductCard(containerElement, props) {
  const quantityDefault = props.defaultQuantity || 1;
  let quantityValue = quantityDefault;

  const normalizeQuantity = (nextQuantity) => {
    const parsedQuantity = Number(nextQuantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      return 1;
    }
    return Math.floor(parsedQuantity);
  };

  const renderCard = () => {
    containerElement.innerHTML = `
      <article class="card-shell">
        <img id="productImageButton" class="product-image-clickable" src="${props.product.image}" alt="${props.product.name}" />
        <strong class="product-name">${props.product.name}</strong>
        <span>$${props.product.price.toFixed(2)}</span>
        <div class="quantity-shell">
          <button id="decreaseQuantityButton" class="quantity-control-button" type="button">-</button>
          <input id="quantityInput" class="quantity-value-input" type="number" min="1" value="${quantityValue}" />
          <button id="increaseQuantityButton" class="quantity-control-button" type="button">+</button>
        </div>
        <button id="addToCartButton" class="button-like add-cart-button">Add to Cart</button>
      </article>
    `;

    const productImageButton = containerElement.querySelector("#productImageButton");
    const quantityInput = containerElement.querySelector("#quantityInput");
    const decreaseQuantityButton = containerElement.querySelector("#decreaseQuantityButton");
    const increaseQuantityButton = containerElement.querySelector("#increaseQuantityButton");
    const addToCartButton = containerElement.querySelector("#addToCartButton");

    productImageButton.addEventListener("click", () => {
      props.onProductClick(props.product.id);
    });

    decreaseQuantityButton.addEventListener("click", () => {
      quantityValue = Math.max(quantityValue - 1, 1);
      quantityInput.value = String(quantityValue);
    });

    increaseQuantityButton.addEventListener("click", () => {
      quantityValue += 1;
      quantityInput.value = String(quantityValue);
    });

    quantityInput.addEventListener("change", (event) => {
      quantityValue = normalizeQuantity(event.target.value);
      event.target.value = String(quantityValue);
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
