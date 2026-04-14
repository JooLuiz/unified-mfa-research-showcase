import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function CheckoutItemsView({ cartItems, productsById, onQuantityChange }) {
  const normalizeQuantity = (nextQuantity) => {
    const parsedQuantity = Number(nextQuantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      return 1;
    }
    return Math.floor(parsedQuantity);
  };

  return (
    <section className="checkout-items-shell">
      <h2>Checkout</h2>
      {cartItems.length === 0 && <p>Your cart is empty.</p>}
      {cartItems.map((cartItem) => {
        const product = productsById[cartItem.productId];
        if (!product) {
          return null;
        }

        return (
          <article key={cartItem.productId} className="checkout-item">
            <img src={product.image} alt={product.name} className="checkout-item-image" />
            <div className="checkout-item-details">
              <strong>{product.name}</strong>
              <span>${(product.price * cartItem.quantity).toFixed(2)}</span>
            </div>
            <div className="checkout-quantity-shell">
              <button
                className="checkout-quantity-button"
                onClick={() => onQuantityChange(cartItem.productId, Math.max(cartItem.quantity - 1, 1))}
              >
                -
              </button>
              <input
                className="checkout-quantity-input"
                type="number"
                min="1"
                value={cartItem.quantity}
                onChange={(event) => {
                  onQuantityChange(cartItem.productId, normalizeQuantity(event.target.value));
                }}
              />
              <button
                className="checkout-quantity-button"
                onClick={() => onQuantityChange(cartItem.productId, cartItem.quantity + 1)}
              >
                +
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function mountCheckoutItems(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(
    <CheckoutItemsView
      cartItems={props.cartItems}
      productsById={props.productsById}
      onQuantityChange={props.onQuantityChange}
    />,
  );

  return () => {
    root.unmount();
  };
}
